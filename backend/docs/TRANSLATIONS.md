# Backend Translations with Flask-Babel

This project uses Flask-Babel for internationalization (i18n) of backend API messages.

## Setup

1. **Install Flask-Babel** (already in requirements.txt):
   ```bash
   pip install Flask-Babel
   ```

2. **Translation files are located in**: `app/translations/`

## Adding New Translations

1. **Mark strings for translation** in your code:
   ```python
   from flask_babel import _
   
   return jsonify({"error": _("Error message")})
   ```

2. **Extract translatable strings**:
   ```bash
   pybabel extract -F babel.cfg -k _ -o messages.pot app/
   ```

3. **Update translation files**:
   ```bash
   pybabel update -i messages.pot -d app/translations
   ```

4. **Edit translation files**:
   - Edit `app/translations/en/LC_MESSAGES/messages.po` for English
   - Edit `app/translations/de/LC_MESSAGES/messages.po` for German
   - Fill in the `msgstr ""` fields with translations

5. **Compile translations**:
   ```bash
   pybabel compile -d app/translations
   ```

## Using Variables in Translations

Use Python string formatting with named parameters:

```python
_("Error occurred: %(error)s", error=str(e))
```

In the `.po` file:
```po
msgid "Error occurred: %(error)s"
msgstr "Fehler aufgetreten: %(error)s"
```

## Language Selection

The backend automatically selects the language based on the `Accept-Language` HTTP header sent by the frontend. Supported languages:
- `en` - English (default)
- `de` - German

## Quick Setup Script

Use the provided script to set up translations. Run from the `backend/` directory:
```bash
./scripts/setup_translations.sh
```

Or from the project root:
```bash
./backend/scripts/setup_translations.sh
```

## Workflow

1. Add new translatable strings with `_()` in code
2. Run `pybabel extract` to update `messages.pot`
3. Run `pybabel update` to update language files
4. Edit `.po` files with translations
5. Run `pybabel compile` to create `.mo` files
6. Restart the Flask application

