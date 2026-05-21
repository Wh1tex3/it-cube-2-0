import rarfile
import os

rar_path = "Robototehnika.rar"
extract_path = "temp_rar_extract"

if not os.path.exists(extract_path):
    os.makedirs(extract_path)

try:
    with rarfile.RarFile(rar_path) as rf:
        rf.extractall(extract_path)
    print("Extraction successful")
    # List extracted files
    for root, dirs, files in os.walk(extract_path):
        for file in files:
            print(os.path.join(root, file))
except rarfile.RarCannotExec as e:
    print(f"Error: unrar tool not found. rarfile needs unrar executable. {e}")
except Exception as e:
    print(f"Error extracting: {e}")
