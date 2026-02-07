#!/bin/bash
# Script to set up Flask-Babel translations

set -e  # Exit on error

# Change to backend directory
cd "$(dirname "$0")/.."

# Verify we're in the correct directory
if [ ! -f "babel.cfg" ] || [ ! -d "app" ]; then
    echo "❌ Error: Must be run from backend directory or script location"
    echo "   Expected files: babel.cfg and app/ directory"
    exit 1
fi

# Check if pybabel is installed
if ! command -v pybabel &> /dev/null; then
    echo "❌ Error: pybabel is not installed"
    echo "   Install with: pip install Flask-Babel"
    exit 1
fi

# Extract translatable strings
echo "📝 Extracting translatable strings..."
pybabel extract -F babel.cfg -k _ -o messages.pot app/

# Initialize translations for English (if not exists)
if [ ! -d "app/translations/en/LC_MESSAGES" ]; then
    echo "🌐 Initializing English translations..."
    pybabel init -i messages.pot -d app/translations -l en
fi

# Initialize translations for German (if not exists)
if [ ! -d "app/translations/de/LC_MESSAGES" ]; then
    echo "🌐 Initializing German translations..."
    pybabel init -i messages.pot -d app/translations -l de
fi

# Update existing translations
echo "🔄 Updating existing translations..."
pybabel update -i messages.pot -d app/translations

# Compile translations
echo "🔨 Compiling translations..."
pybabel compile -d app/translations

echo ""
echo "✅ Translation files set up successfully!"
echo "📝 Edit translation files in app/translations/*/LC_MESSAGES/messages.po"
echo "🔄 After editing, run: pybabel compile -d app/translations"

