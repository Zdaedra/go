import openai
import os
import uuid
import concurrent.futures

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
openai.api_key = OPENAI_API_KEY

def create_audio(text, file_path):
    response = openai.audio.speech.create(
        model="tts-1",
        voice="alloy",
        input=text
    )
    response.stream_to_file(file_path)

def generate_tts_for_lesson(lesson_json: dict, temp_dir: str):
    """
    Loops through the moments and steps and uses OpenAI TTS to generate audio concurrently.
    Mutates the lesson object to embed the URLs.
    Returns an array of file (path, file_name) tuples.
    """
    audio_files = []
    tasks = []
    
    for m_idx, moment in enumerate(lesson_json.get("moments", [])):
        moment_type_prefix = "m" if moment.get("type") == "mistake" else "s"
        m_num = moment.get("move_number", m_idx)
        
        for step_idx, step in enumerate(moment.get("steps", [])):
            text = step.get("say", "")
            if not text:
                step["audio"] = {"url": ""}
                continue
                
            file_name = f"{moment_type_prefix}{m_num}_{step_idx+1:02d}.mp3"
            file_path = os.path.join(temp_dir, file_name)
            
            tasks.append((text, file_path, file_name, step))
            
    # parallelize TTS processing to avoid very long waits
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(create_audio, t[0], t[1]): t for t in tasks}
        for future in concurrent.futures.as_completed(futures):
            text, file_path, file_name, step = futures[future]
            try:
                future.result()
                audio_files.append((file_path, file_name))
                step["audio"] = {"url": file_name}
            except Exception as e:
                print(f"Error generating audio for {file_name}: {e}")
                step["audio"] = {"url": ""}
                
    return audio_files
