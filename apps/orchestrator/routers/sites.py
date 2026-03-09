from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
import celery_app as tasks
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

router = APIRouter(prefix="/v1/sites", tags=["Sites"])

class SiteCreate(BaseModel):
    name: str
    base_url: str
    login_credentials: Optional[Dict[str, Any]] = None
    crawl_depth: int = 3
    game_mode: bool = False

class SiteResponse(SiteCreate):
    id: int
    status: str

    class Config:
        orm_mode = True

@router.post("/", response_model=SiteResponse)
def create_site(site: SiteCreate, db: Session = Depends(get_db)):
    new_site = models.Site(
        name=site.name,
        base_url=site.base_url,
        login_credentials=site.login_credentials,
        crawl_depth=site.crawl_depth,
        game_mode=site.game_mode,
        status="Stopped"
    )
    db.add(new_site)
    db.commit()
    db.refresh(new_site)
    return new_site

@router.get("/", response_model=List[SiteResponse])
def get_sites(db: Session = Depends(get_db)):
    return db.query(models.Site).all()

@router.get("/{site_id}", response_model=SiteResponse)
def get_site(site_id: int, db: Session = Depends(get_db)):
    site = db.query(models.Site).filter(models.Site.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return site

@router.post("/{site_id}/crawl")
def trigger_crawl(site_id: int, db: Session = Depends(get_db)):
    site = db.query(models.Site).filter(models.Site.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
        
    site.status = "Running"
    
    # Create a crawl run tracking record
    run = models.CrawlRun(site_id=site.id, status="Running")
    db.add(run)
    db.commit()
    
    # Push to Celery / Redis queue for crawler-worker
    tasks.start_crawl.delay(site.id, site.base_url)
    
    return {"status": "success", "run_id": run.id}
