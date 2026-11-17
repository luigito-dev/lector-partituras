"""Servidor de lectura de partituras (OMR) para la app "Lector de partituras para trombón".
Recibe imágenes de páginas, las lee con homr y devuelve un MusicXML. Trabaja con una cola:
POST /api/jobs  -> {id}      GET /api/jobs/{id} -> estado, progreso y resultado."""
import os, shutil, subprocess, sys, tempfile, threading, time, uuid, queue
import xml.etree.ElementTree as ET
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

MAX_FILES, MAX_BYTES, MAX_QUEUE, PAGE_TIMEOUT, KEEP_SECONDS = 20, 15 * 1024 * 1024, 4, 420, 3600
ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",")]
HOMR = os.environ.get("HOMR_CMD", "homr")

app = FastAPI(title="Servidor OMR")
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_methods=["*"], allow_headers=["*"])
jobs, q = {}, queue.Queue()


def read_page(path):
    """Ejecuta homr en un proceso aparte (libera memoria al terminar). Devuelve la ruta del MusicXML."""
    subprocess.run([HOMR, path], capture_output=True, timeout=PAGE_TIMEOUT, check=False)
    xml = os.path.splitext(path)[0] + ".musicxml"
    if not os.path.exists(xml):
        raise RuntimeError("No se encontraron pentagramas legibles en esta página.")
    return xml


def merge(xmls):
    base = ET.parse(xmls[0]); root = base.getroot(); part = root.find("part"); n = len(part.findall("measure"))
    for x in xmls[1:]:
        for m in ET.parse(x).getroot().find("part").findall("measure"):
            n += 1; m.set("number", str(n)); part.append(m)
    pn = root.find(".//part-name")
    if pn is not None: pn.text = "Trombón"
    return ET.tostring(root, encoding="unicode", xml_declaration=False)


def worker():
    while True:
        jid = q.get(); job = jobs.get(jid)
        if not job: continue
        job["status"] = "running"; xmls, skipped = [], []
        try:
            for i, p in enumerate(job["files"], 1):
                job["page"] = i
                try: xmls.append(read_page(p))
                except Exception as e: skipped.append(f"Página {i}: {e}")
            if not xmls: raise RuntimeError("No se pudo leer ninguna página. " + " ".join(skipped))
            job["musicxml"] = '<?xml version="1.0" encoding="UTF-8"?>' + merge(xmls)
            job["warnings"] = skipped; job["status"] = "done"
        except Exception as e:
            job["status"] = "error"; job["message"] = str(e)
        finally:
            shutil.rmtree(job["dir"], ignore_errors=True); job["finished"] = time.time()


threading.Thread(target=worker, daemon=True).start()


def cleanup():
    for k in [k for k, j in jobs.items() if j.get("finished") and time.time() - j["finished"] > KEEP_SECONDS]: jobs.pop(k, None)


@app.get("/")
def health(): return {"ok": True, "servicio": "OMR trombón", "en_cola": q.qsize()}


@app.post("/api/jobs")
async def create(files: list[UploadFile] = File(...)):
    cleanup()
    if q.qsize() >= MAX_QUEUE: raise HTTPException(503, "El servidor está ocupado. Intenta de nuevo en unos minutos.")
    if not files or len(files) > MAX_FILES: raise HTTPException(400, f"Envía entre 1 y {MAX_FILES} páginas.")
    d = tempfile.mkdtemp(prefix="omr_"); paths = []
    for i, f in enumerate(files, 1):
        data = await f.read()
        if len(data) > MAX_BYTES: shutil.rmtree(d, ignore_errors=True); raise HTTPException(413, "Una imagen pesa más de 15 MB.")
        if data[:3] == b"\xff\xd8\xff": ext = "jpg"
        elif data[:8] == b"\x89PNG\r\n\x1a\n": ext = "png"
        else: shutil.rmtree(d, ignore_errors=True); raise HTTPException(400, "Solo se aceptan imágenes JPG o PNG.")
        p = os.path.join(d, f"p{i:02d}.{ext}"); open(p, "wb").write(data); paths.append(p)
    jid = uuid.uuid4().hex[:12]
    jobs[jid] = {"status": "queued", "page": 0, "total": len(paths), "files": paths, "dir": d, "created": time.time()}
    q.put(jid); return {"id": jid}


@app.get("/api/jobs/{jid}")
def status(jid: str):
    j = jobs.get(jid)
    if not j: raise HTTPException(404, "Trabajo no encontrado (puede haber caducado).")
    out = {"status": j["status"], "page": j["page"], "total": j["total"]}
    if j["status"] == "done": out.update(musicxml=j["musicxml"], warnings=j.get("warnings", []))
    if j["status"] == "error": out["message"] = j.get("message", "Error")
    return out
