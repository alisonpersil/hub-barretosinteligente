import os
import sys

def optimize_for_vercel():
    print("[Vercel Build] Iniciando otimização do bundle para Vercel Lambda...")
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Extensions of heavy binary files to purge from the build container
    heavy_exts = {'.pdf', '.xls', '.xlsx', '.pkl'}
    
    removed = 0
    freed = 0
    
    for dirpath, dirnames, filenames in os.walk(root_dir):
        if '.git' in dirpath or '.venv' in dirpath:
            continue
        for f in filenames:
            ext = os.path.splitext(f)[1].lower()
            if ext in heavy_exts or f.lower() == 'atendidos_cache.pkl':
                full_path = os.path.join(dirpath, f)
                try:
                    sz = os.path.getsize(full_path)
                    os.remove(full_path)
                    removed += 1
                    freed += sz
                except Exception as e:
                    print(f"Aviso ao remover {f}: {e}", file=sys.stderr)
                    
    freed_mb = freed / (1024 * 1024)
    print(f"[Vercel Build] Removidos {removed} arquivos binários pesados ({freed_mb:.1f} MB liberados).")
    print("[Vercel Build] Arquivos continuam preservados no GitHub e serão servidos via GitHub API.")
    print("[Vercel Build] Concluído com sucesso!")

if __name__ == "__main__":
    is_vercel = bool(os.environ.get("VERCEL")) or "--vercel" in sys.argv
    if is_vercel:
        optimize_for_vercel()
    else:
        print("[Vercel Build] Modo local: preservando arquivos do workspace.")
