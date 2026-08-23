"""
Ollama HTTP Client for TalentIQ
Handles local communication with Ollama API (http://localhost:11434/api/chat)
supporting JSON mode, timeout controls, model verification, and safe error handling.
"""

import os
import json
import logging
from typing import Dict, Any, Optional, List
import httpx

logger = logging.getLogger("talentiq.ollama_client")

class OllamaClient:
    def __init__(self):
        self.base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
        self.model_name = os.getenv("OLLAMA_MODEL", "ornith:9b")
        self.timeout = float(os.getenv("OLLAMA_TIMEOUT", "120"))
        self.temperature = float(os.getenv("AI_TEMPERATURE", "0.2"))

    def check_health_sync(self) -> Dict[str, Any]:
        """Verify Ollama server reachability and model presence synchronously."""
        url = f"{self.base_url}/api/tags"
        try:
            with httpx.Client(timeout=5.0) as client:
                response = client.get(url)
                if response.status_code == 200:
                    models_data = response.json().get("models", [])
                    available_model_names = [m.get("name") for m in models_data]
                    
                    # Check if requested model or matching tag is installed
                    model_found = any(
                        self.model_name == name or name.startswith(f"{self.model_name}:")
                        for name in available_model_names
                    )
                    
                    if model_found:
                        return {
                            "provider": "ollama",
                            "model": self.model_name,
                            "status": "healthy",
                            "message": f"Ollama is online and model '{self.model_name}' is loaded."
                        }
                    else:
                        return {
                            "provider": "ollama",
                            "model": self.model_name,
                            "status": "unavailable",
                            "message": f"Configured Ollama model '{self.model_name}' is not installed. Run 'ollama pull {self.model_name}'."
                        }
                else:
                    return {
                        "provider": "ollama",
                        "model": self.model_name,
                        "status": "unavailable",
                        "message": f"Ollama server returned status code {response.status_code}."
                    }
        except Exception as e:
            return {
                "provider": "ollama",
                "model": self.model_name,
                "status": "unavailable",
                "message": "AI service is currently unavailable. Please ensure Ollama is running."
            }

    async def check_health_async(self) -> Dict[str, Any]:
        """Verify Ollama server reachability and model presence asynchronously."""
        url = f"{self.base_url}/api/tags"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(url)
                if response.status_code == 200:
                    models_data = response.json().get("models", [])
                    available_model_names = [m.get("name") for m in models_data]
                    model_found = any(
                        self.model_name == name or name.startswith(f"{self.model_name}:")
                        for name in available_model_names
                    )
                    if model_found:
                        return {
                            "provider": "ollama",
                            "model": self.model_name,
                            "status": "healthy",
                            "message": f"Ollama is online and model '{self.model_name}' is loaded."
                        }
                    else:
                        return {
                            "provider": "ollama",
                            "model": self.model_name,
                            "status": "unavailable",
                            "message": f"Configured Ollama model '{self.model_name}' is not installed. Run 'ollama pull {self.model_name}'."
                        }
                else:
                    return {
                        "provider": "ollama",
                        "model": self.model_name,
                        "status": "unavailable",
                        "message": f"Ollama server returned status code {response.status_code}."
                    }
        except Exception as e:
            return {
                "provider": "ollama",
                "model": self.model_name,
                "status": "unavailable",
                "message": "AI service is currently unavailable. Please ensure Ollama is running."
            }

    async def chat_async(
        self,
        system_prompt: str,
        user_prompt: str,
        json_mode: bool = True,
        temperature: Optional[float] = None
    ) -> str:
        """Asynchronously call Ollama /api/chat endpoint."""
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "stream": False,
            "options": {
                "temperature": temperature if temperature is not None else self.temperature
            }
        }
        if json_mode:
            payload["format"] = "json"

        attempts = 0
        max_attempts = 2

        while attempts < max_attempts:
            attempts += 1
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    res = await client.post(url, json=payload)
                    if res.status_code == 200:
                        data = res.json()
                        content = data.get("message", {}).get("content", "").strip()
                        return content
                    else:
                        logger.error(f"Ollama error status {res.status_code}: {res.text}")
                        if attempts >= max_attempts:
                            raise RuntimeError(f"Ollama returned HTTP {res.status_code}")
            except httpx.ConnectError:
                raise ConnectionError("AI service is currently unavailable. Please ensure Ollama is running.")
            except Exception as e:
                logger.warning(f"Ollama chat attempt {attempts} failed: {e}")
                if attempts >= max_attempts:
                    raise e
        return ""

    def chat_sync(
        self,
        system_prompt: str,
        user_prompt: str,
        json_mode: bool = True,
        temperature: Optional[float] = None
    ) -> str:
        """Synchronously call Ollama /api/chat endpoint."""
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "stream": False,
            "options": {
                "temperature": temperature if temperature is not None else self.temperature
            }
        }
        if json_mode:
            payload["format"] = "json"

        attempts = 0
        max_attempts = 2

        while attempts < max_attempts:
            attempts += 1
            try:
                with httpx.Client(timeout=self.timeout) as client:
                    res = client.post(url, json=payload)
                    if res.status_code == 200:
                        data = res.json()
                        return data.get("message", {}).get("content", "").strip()
                    else:
                        logger.error(f"Ollama error status {res.status_code}: {res.text}")
                        if attempts >= max_attempts:
                            raise RuntimeError(f"Ollama returned HTTP {res.status_code}")
            except httpx.ConnectError:
                raise ConnectionError("AI service is currently unavailable. Please ensure Ollama is running.")
            except Exception as e:
                logger.warning(f"Ollama chat attempt {attempts} failed: {e}")
                if attempts >= max_attempts:
                    raise e
        return ""

ollama_client_instance = OllamaClient()
