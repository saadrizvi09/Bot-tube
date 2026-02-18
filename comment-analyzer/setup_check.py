"""
Setup script for Comment Analyzer - installs dependencies only if needed.
"""
import subprocess
import sys
import os
import site
from pathlib import Path

def check_venv_properly_activated():
    """Check if virtual environment is properly isolated."""
    in_venv = hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix)
    
    if not in_venv:
        return False, "Not in a virtual environment"
    
    # Check if site-packages is in the venv directory
    site_packages = site.getsitepackages()[0]
    expected_venv_path = os.path.join(os.getcwd(), 'venv')
    
    if expected_venv_path.lower() not in site_packages.lower():
        return False, f"Virtual environment not properly isolated. Packages installing to: {site_packages}"
    
    return True, "Virtual environment properly configured"

def check_package(package_name):
    """Check if a package is installed."""
    try:
        __import__(package_name)
        return True
    except ImportError:
        return False

def check_nltk_data():
    """Check if VADER lexicon is downloaded."""
    try:
        import nltk
        try:
            nltk.data.find('sentiment/vader_lexicon.zip')
            return True
        except LookupError:
            return False
    except ImportError:
        return False

def main():
    print("=" * 50)
    print("Comment Analyzer Setup")
    print("=" * 50)
    print()
    
    # Check virtual environment
    venv_ok, venv_msg = check_venv_properly_activated()
    print(f"Virtual Environment: {venv_msg}")
    print(f"Python Location: {sys.executable}")
    print(f"Site Packages: {site.getsitepackages()[0]}")
    print()
    
    if not venv_ok:
        print("⚠️  ERROR: Virtual environment issue detected!")
        print()
        print("Your venv is not properly isolated. Packages are installing")
        print("to the system Python instead of the virtual environment.")
        print()
        print("To fix this, run from the root folder:")
        print("  .\\fix-venv.bat")
        print()
        input("Press Enter to exit...")
        sys.exit(1)
    
    # Check if key packages are installed
    needs_install = False
    key_packages = ['fastapi', 'uvicorn', 'googleapiclient', 'vaderSentiment']
    
    print("Checking dependencies...")
    for package in key_packages:
        if not check_package(package):
            print(f"  ❌ {package} not found")
            needs_install = True
        else:
            print(f"  ✅ {package} installed")
    
    if needs_install:
        print()
        print("Installing missing packages...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "-r", "requirements.txt"])
        print("✅ Dependencies installed!")
    else:
        print("✅ All dependencies already installed!")
    
    print()
    
    # Check NLTK data
    print("Checking NLTK VADER lexicon...")
    if not check_nltk_data():
        print("  Downloading VADER lexicon...")
        import nltk
        nltk.download('vader_lexicon', quiet=True)
        print("✅ VADER lexicon downloaded!")
    else:
        print("✅ VADER lexicon already downloaded!")
    
    print()
    print("=" * 50)
    print("Setup complete! Starting server...")
    print("=" * 50)
    print()

if __name__ == "__main__":
    main()
