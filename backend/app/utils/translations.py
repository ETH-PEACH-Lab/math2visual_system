"""
Translation utilities for cross-language SVG search support.
Uses argos-translate for offline, fast translations between English and German.
Note: API message translation is handled by Flask-Babel (see app/__init__.py).
"""

import logging
from functools import lru_cache
from typing import Optional

logger = logging.getLogger(__name__)

# Translation cache to avoid repeated translations
_translation_cache: dict[tuple[str, str, str], Optional[str]] = {}


@lru_cache(maxsize=1000)
def _translate_term(term: str, from_lang: str, to_lang: str) -> Optional[str]:
    """
    Translate a single term using argos-translate with caching.
    
    Args:
        term: The term to translate
        from_lang: Source language ('en' or 'de')
        to_lang: Target language ('en' or 'de')
        
    Returns:
        Translated term or None if translation fails or models not installed
    """
    # Check cache first
    cache_key = (term.lower(), from_lang, to_lang)
    if cache_key in _translation_cache:
        return _translation_cache[cache_key]
    
    try:
        import argostranslate.translate
        
        # Perform translation
        translated = argostranslate.translate.translate(term, from_lang, to_lang)
        
        if translated and translated.lower() != term.lower():
            # Cache result
            _translation_cache[cache_key] = translated.lower()
            return translated.lower()
        else:
            _translation_cache[cache_key] = None
            return None
        
    except ImportError:
        logger.debug("argostranslate not installed. Install with: pip install argostranslate")
        _translation_cache[cache_key] = None
        return None
    except Exception as e:
        logger.debug(f"Translation failed for '{term}' ({from_lang}->{to_lang}): {e}")
        _translation_cache[cache_key] = None
        return None


def get_translations(term: str) -> list[str]:
    """
    Get all translations for a given term (including the term itself).
    Automatically detects language and provides bidirectional translations.
    
    Args:
        term: The search term
        
    Returns:
        List of terms including the original and all translations
    """
    term_lower = term.lower().strip()
    if not term_lower:
        return [term_lower]
    
    translations = {term_lower}  # Start with the original term
    
    # Try translating in both directions
    # English -> German
    de_translation = _translate_term(term_lower, 'en', 'de')
    if de_translation:
        translations.add(de_translation)
    
    # German -> English
    en_translation = _translate_term(term_lower, 'de', 'en')
    if en_translation:
        translations.add(en_translation)
    
    return list(translations)


def expand_search_terms(query: str) -> list[str]:
    """
    Expand a search query to include translations.
    Handles multi-word queries by translating the entire phrase.
    
    Args:
        query: The search query string
        
    Returns:
        List of search terms including original and translations
    """
    query_lower = query.lower().strip()
    if not query_lower:
        return [query_lower]
    
    search_terms = {query_lower}  # Start with original query
    
    # Try translating the entire phrase
    de_translation = _translate_term(query_lower, 'en', 'de')
    if de_translation:
        search_terms.add(de_translation)
    
    en_translation = _translate_term(query_lower, 'de', 'en')
    if en_translation:
        search_terms.add(en_translation)
    
    return list(search_terms)


def ensure_translation_models_installed(auto_install: bool = False) -> bool:
    """
    Check if translation models are installed and optionally install them if missing.
    
    Args:
        auto_install: If True, attempt to install missing models. If False, only check.
        
    Returns:
        True if both models are installed, False otherwise
    """
    try:
        import argostranslate.package
        
        installed_packages = argostranslate.package.get_installed_packages()
        installed_codes = [f"{p.from_code}_{p.to_code}" for p in installed_packages]
        
        has_en_de = 'en_de' in installed_codes
        has_de_en = 'de_en' in installed_codes
        
        if has_en_de and has_de_en:
            print("✅ Translation models (en_de, de_en) are installed")
            return True
        
        missing_models = []
        if not has_en_de:
            missing_models.append('en_de')
        if not has_de_en:
            missing_models.append('de_en')
        
        print(
            f"⚠️  Translation models missing: {', '.join(missing_models)}. "
            f"Cross-language SVG search will be limited."
        )
        print(
            "   Install models with: python backend/scripts/install_translation_models.py"
        )
        
        if auto_install:
            print("Attempting to install missing translation models...")
            try:
                argostranslate.package.update_package_index()
                available_packages = argostranslate.package.get_available_packages()
                
                for model_code in missing_models:
                    from_lang, to_lang = model_code.split('_')
                    matching_packages = [
                        pkg for pkg in available_packages
                        if pkg.from_code == from_lang and pkg.to_code == to_lang
                    ]
                    
                    if matching_packages:
                        print(f"Installing {model_code} model...")
                        download_path = matching_packages[0].download()
                        argostranslate.package.install_from_path(download_path)
                        print(f"✅ {model_code} model installed successfully")
                    else:
                        print(f"❌ {model_code} model not found in available packages")
                
                # Verify installation
                installed_packages = argostranslate.package.get_installed_packages()
                installed_codes = [f"{p.from_code}_{p.to_code}" for p in installed_packages]
                
                if 'en_de' in installed_codes and 'de_en' in installed_codes:
                    print("✅ All translation models installed successfully")
                    return True
                else:
                    print("⚠️  Some translation models may still be missing")
                    return False
                    
            except Exception as e:
                print(f"❌ Failed to install translation models: {e}")
                print(
                    "   Models will be installed automatically on next startup, or install manually via Python"
                )
                return False
        
        return False
        
    except ImportError:
        logger.debug("argostranslate not installed - translation features disabled")
        return False
    except Exception as e:
        logger.debug(f"Error checking translation models: {e}")
        return False


