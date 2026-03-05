import openai
import os
import json

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

openai.api_key = OPENAI_API_KEY

import uuid
import concurrent.futures

def generate_storyboard(analysis_data, game_id: str):
    """
    LLM evaluates the analysis data and selects 4-6 key scenes,
    generating the chapters, keyFindings, and practice parts of the Storyboard JSON.
    """
    # Group/Filter moments: Top 8 Mistakes (delta < -1.5), Top 8 Strong Moves (delta > +1.5)
    # Note: in katago_runner, negative delta = point loss (mistake), positive delta = point gain (strong)
    mistakes = sorted([d for d in analysis_data if d.get("delta", 0) < -1.5], key=lambda x: x["delta"])[:8]
    strong_moves = sorted([d for d in analysis_data if d.get("delta", 0) > 1.5], key=lambda x: x["delta"], reverse=True)[:8]
    
    prompt_context = "Analysis summary of the 9x9 Go game:\n"
    prompt_context += "--- MISTAKES (Negative point swings) ---\n"
    for m in mistakes:
        prompt_context += f"Turn {m['turn']}: {m['color']} played {m['actual_move']}. Score dropped by {abs(m['delta']):0.1f} points. Best alternatives were {', '.join(m.get('best_moves', []))}.\n"
        if m.get("best_pv"):
            prompt_context += "  Engine PVs:\n"
            for i, pv in enumerate(m["best_pv"]):
                prompt_context += f"    Line {i+1}: {', '.join(pv)}\n"
            
    prompt_context += "\n--- STRONG MOVES (Positive point swings) ---\n"
    for m in strong_moves:
        prompt_context += f"Turn {m['turn']}: {m['color']} played {m['actual_move']}. Score gained by {m['delta']:0.1f} points.\n"

    system_prompt = """You are a Go (Weiqi / Baduk) coach. Analyze the provided game mistakes and strong moves.
Pick EXACTLY 8-12 key moments for an interactive lesson, ensuring there are at least 5 mistakes and 5 strong moves if they exist in the analysis.
- Prioritize the biggest mistakes and the strongest moves.

For each moment, create a structured mini-lesson with exact 4-6 steps.
Actions types available:
- {"type": "jump", "move": <turn_number_int>}  (Jump to a specific turn in the game)
- {"type": "showPlayedMove"}  (Show the actual move played on this turn)
- {"type": "highlight", "stones": ["C4", "D4"]}
- {"type": "mark", "at": "C4", "shape": "circle"} (shapes: circle, square, triangle, x)
- {"type": "showBestMove", "at": "D4"}
- {"type": "showSequence", "moves": ["C4", "D5", "E5"], "mode": "ghost"}  (Show an engine PV variation)
- {"type": "clearOverlays"}  (Clear highlights, marks, and ghost stones)

All coordinate letters MUST strictly be A-J (excluding I). For example: A1, H9, J3. DO NOT output I as a column.

Your tone must be helpful, encouraging, and clear. Language: Russian.
Use the player's color (B or W) to refer to "you" if applicable, but keep it neutral if unsure.

For Mistakes, follow this exact 5-step narrative structure:
1. Context (jump to move before mistake, highlight area, say "Here is the position...")
2. Played Move (clear overlays, showPlayedMove, say "You played X...")
3. Engine Recommendation (clear overlays, showBestMove, say "KataGo recommends Y (or Z)...")
4. Missed Line (use the "showSequence" action. You MUST copy the longest provided Engine PV line for your chosen best move IN FULL. The "moves" array MUST contain ALL the moves from that line (typically 5-10 moves). It is STRICTLY FORBIDDEN to use only 1 or 2 moves in 'showSequence'.)
5. Consequence in game (clear overlays, jump 2-4 moves ahead, say "In the actual game, you lost this area...")

CRITICAL RULES FOR "say" IN STEP 4 (Missed Line):
- Voiceover MUST match the full long sequence shown on board. Explain the tactical meaning of the exchange from start to finish (e.g., "If you played Y, white would block here, but then you capture, securing the corner...").
- Do not invent moves that are not in the provided Engine PVs, but do explain the full line provided.

Return EXACTLY valid JSON matching this schema:
{
  "moments": [
    {
      "moment_id": "unique_string",
      "type": "mistake", // or "strong"
      "move_number": 12,
      "player": "W", // "B" or "W" (color of the player who made the move)
      "title": "short title",
      "impact": -18.5, // the delta
      "preview": "1 sentence summary",
      "jumpMove": 11, // move before the moment
      "steps": [
        {
          "id": "unique_step_id",
          "say": "sentence in Russian",
          "actions": [{"type": "jump", "move": 11}, {"type": "highlight", "stones": ["D4"]}]
        }
      ]
    }
  ]
}
"""

    response = openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt_context}
        ],
        response_format={ "type": "json_object" },
        temperature=0.2
    )
    
    # Just return the dict representing chapters, keyFindings, practice
    return json.loads(response.choices[0].message.content)

def create_audio(text, file_path):
    response = openai.audio.speech.create(
        model="tts-1",
        voice="alloy",
        input=text
    )
    response.stream_to_file(file_path)

def generate_tts_for_steps(storyboard_json, temp_dir):
    """
    Loops through the chapters/steps and uses OpenAI TTS to generate step_XX_YY.mp3 concurrently.
    Mutates the storyboard dict to embed the temporary local references.
    Returns an array of file (path, name) tuples.
    """
    audio_files = []
    tasks = []
    
    for m_idx, moment in enumerate(storyboard_json.get("moments", [])):
        if "id" not in moment: moment["moment_id"] = f"mom_{uuid.uuid4().hex[:8]}"
            
        for step_idx, step in enumerate(moment.get("steps", [])):
            if "id" not in step: step["id"] = f"st_{uuid.uuid4().hex[:8]}"
                
            text = step.get("say", "")
            if not text:
                step["audio"] = {"url": ""}
                continue
                
            file_name = f"step_{m_idx}_{step_idx}.mp3"
            file_path = os.path.join(temp_dir, file_name)
            
            tasks.append((text, file_path, file_name, step))
            
    # Run tasks in parallel, max 5 at a time to avoid aggressive rate-limiting
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(create_audio, t[0], t[1]): t for t in tasks}
        for future in concurrent.futures.as_completed(futures):
            text, file_path, file_name, step = futures[future]
            try:
                future.result()
                audio_files.append((file_path, file_name))
                step["audio"] = {
                    "url": file_name,
                    "durationSec": 0.0 
                }
            except Exception as exc:
                print(f"TTS generation for {file_name} failed: {exc}")
                step["audio"] = {"url": ""}
            
    return storyboard_json, audio_files

