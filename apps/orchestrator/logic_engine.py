import json
import os
from sqlalchemy.orm import Session
import models

class LogicExtractionEngine:
    """
    Converts raw recorded crawls and state graphs in Postgres into the 
    Product Reconstruction JSON layer artifacts.
    """
    def __init__(self, db: Session, site_id: int):
        self.db = db
        self.site_id = site_id
        
        sites_dir = os.environ.get("SITES_DIR", "/app/sites")
        self.output_dir = f"{sites_dir}/Site_{site_id}/reports"
        os.makedirs(self.output_dir, exist_ok=True)
        
    def build_state_graph(self):
        """
        Generates state_graph.json mapping nodes (ProductStates) and edges (Transitions).
        """
        states = self.db.query(models.ProductState).filter(models.ProductState.site_id == self.site_id).all()
        transitions = self.db.query(models.Transition).join(models.ProductState, models.Transition.source_state_id == models.ProductState.id).filter(models.ProductState.site_id == self.site_id).all()
        
        nodes = []
        for s in states:
            nodes.append({
                "id": s.id,
                "hash": s.state_hash,
                "route": s.route,
                "screen_class": s.screen_class,
                "components_summary": s.visible_components
            })
            
        edges = []
        for t in transitions:
            edges.append({
                "source": t.source_state_id,
                "target": t.target_state_id,
                "action_id": t.action_id,
                "action_type": t.action.type if t.action else "unknown",
                "action_selector": t.action.selector if t.action else ""
            })
            
        graph = {
            "site_id": self.site_id,
            "nodes": nodes,
            "edges": edges,
            "metadata": {
                "total_states": len(nodes),
                "total_transitions": len(edges)
            }
        }
        
        out_path = f"{self.output_dir}/state_graph.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(graph, f, indent=2)
            
        return graph

    def build_features_and_patterns(self):
        """
        Generates features.json and behavior_patterns.json
        """
        features_db = self.db.query(models.Feature).join(models.Screen).filter(models.Screen.site_id == self.site_id).all()
        patterns_db = self.db.query(models.BehaviorPattern).filter(models.BehaviorPattern.site_id == self.site_id).all()
        
        features = [{"id": f.id, "name": f.name, "type": f.type, "action": f.action_description} for f in features_db]
        patterns = [{"id": p.id, "name": p.name, "description": p.description, "evidence": p.evidence_states} for p in patterns_db]
        
        with open(f"{self.output_dir}/features.json", "w", encoding="utf-8") as f:
            json.dump(features, f, indent=2)
            
        with open(f"{self.output_dir}/behavior_patterns.json", "w", encoding="utf-8") as f:
            json.dump(patterns, f, indent=2)
            
        return {"features": len(features), "patterns": len(patterns)}
        
    def generate_reconstruction_notes(self):
        """
        Synthesizes the JSONs into a human readable reconstruction_notes.md artifact
        """
        metrics = self.db.query(models.ProductState).filter(models.ProductState.site_id == self.site_id).count()
        trans_metrics = self.db.query(models.Transition).join(models.ProductState, models.Transition.source_state_id == models.ProductState.id).filter(models.ProductState.site_id == self.site_id).count()
        
        md_content = f"# AI Product Reconstruction Notes\n\n"
        md_content += f"## Site {self.site_id} Synthesis\n"
        md_content += f"- **States Discovered**: {metrics}\n"
        md_content += f"- **Transitions Found**: {trans_metrics}\n\n"
        md_content += f"## Screen Map\n"
        md_content += f"See `state_graph.json` for the full node edge traversal.\n\n"
        md_content += f"## Logic Extraction\n"
        md_content += f"The crawler has successfully identified unique canonical states. Further semantic feature extraction is mapped to `features.json`.\n"
        
        with open(f"{self.output_dir}/reconstruction_notes.md", "w", encoding="utf-8") as f:
            f.write(md_content)
            
        return f"{self.output_dir}/reconstruction_notes.md"
