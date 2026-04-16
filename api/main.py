"""
LifeOS Backend API — Grok 4.20 powered governance system
Replaces Supabase Edge Functions
"""
import os
import json
import uuid
import time
import hashlib
from datetime import datetime, timedelta, timezone
from contextlib import asynccontextmanager

import jwt
import httpx
import asyncpg
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, EmailStr
from typing import Optional

# ─── Config ──────────────────────────────────────────────────

DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/lifeos")
XAI_API_KEY = os.getenv("XAI_API_KEY", "")
JWT_SECRET = os.getenv("JWT_SECRET", "lifeos-secret-2026-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 72

pool: asyncpg.Pool | None = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global pool
    pool = await asyncpg.create_pool(DB_URL, min_size=2, max_size=10)
    yield
    await pool.close()

app = FastAPI(title="LifeOS API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# ─── Auth Helpers ────────────────────────────────────────────

def hash_pw(password: str) -> str:
    return hashlib.sha256((password + JWT_SECRET).encode()).hexdigest()

def create_token(user_id: str) -> str:
    return jwt.encode({"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS)}, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(auth[7:], JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload["sub"]
    except Exception:
        raise HTTPException(401, "Invalid token")

# ─── Auth Endpoints ──────────────────────────────────────────

class RegisterReq(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginReq(BaseModel):
    email: EmailStr
    password: str

@app.post("/api/auth/register")
async def register(data: RegisterReq):
    hashed = hash_pw(data.password)
    user_id = str(uuid.uuid4())
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO users (id, email, hashed_password) VALUES ($1, $2, $3)",
                uuid.UUID(user_id), data.email, hashed
            )
            await conn.execute(
                "INSERT INTO profiles (id, name) VALUES ($1, $2)",
                uuid.UUID(user_id), data.name
            )
        return {"access_token": create_token(user_id), "token_type": "bearer"}
    except asyncpg.UniqueViolationError:
        raise HTTPException(409, "Email already registered")

@app.post("/api/auth/login")
async def login(data: LoginReq):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, hashed_password FROM users WHERE email = $1", data.email
        )
    if not row or row["hashed_password"] != hash_pw(data.password):
        raise HTTPException(401, "Invalid credentials")
    return {"access_token": create_token(str(row["id"])), "token_type": "bearer"}

@app.get("/api/auth/me")
async def me(user_id: str = Depends(get_current_user)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT u.id, u.email, p.name, p.company, p.role, p.sector, p.size, p.onboarding_completed FROM users u JOIN profiles p ON p.id = u.id WHERE u.id = $1",
            uuid.UUID(user_id)
        )
    if not row:
        raise HTTPException(404)
    return dict(row)

# ─── Profile ─────────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    sector: Optional[str] = None
    size: Optional[str] = None
    onboarding_completed: Optional[bool] = None

@app.put("/api/profile")
async def update_profile(data: ProfileUpdate, user_id: str = Depends(get_current_user)):
    fields = {k: v for k, v in data.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(400, "No fields")
    sets = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(fields.keys()))
    vals = [uuid.UUID(user_id)] + list(fields.values())
    async with pool.acquire() as conn:
        await conn.execute(f"UPDATE profiles SET {sets}, updated_at = now() WHERE id = $1", *vals)
    return {"status": "ok"}

@app.get("/api/profile")
async def get_profile(user_id: str = Depends(get_current_user)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM profiles WHERE id = $1", uuid.UUID(user_id))
    return dict(row) if row else {}

# ─── Decisions ───────────────────────────────────────────────

@app.get("/api/decisions")
async def list_decisions(user_id: str = Depends(get_current_user)):
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM decisions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
            uuid.UUID(user_id)
        )
    return [dict(r) for r in rows]

@app.post("/api/decisions")
async def create_decision(data: dict, user_id: str = Depends(get_current_user)):
    uid = uuid.UUID(user_id)
    did = uuid.uuid4()
    pid = f"pipe_{did.hex[:12]}"
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO decisions (id, user_id, pipeline_id, description, decision_type, impact, reversibility, urgency, resources_required, verdict, overall_score, blocked, state_id, state_severity, human_score, business_score, financial_score, relational_score, domain_financial, domain_emotional, domain_decisional, domain_operational, domain_relational, domain_energetic, full_result, guidance_text)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)""",
            did, uid, pid,
            data.get("description", ""),
            data.get("decision_type", "tactical"),
            data.get("impact", "medium"),
            data.get("reversibility", "moderate"),
            data.get("urgency", "moderate"),
            data.get("resources_required"),
            data.get("verdict", "NÃO AGORA"),
            data.get("overall_score", 0),
            data.get("blocked", False),
            data.get("state_id", "building"),
            data.get("state_severity", 50),
            data.get("human_score"),
            data.get("business_score"),
            data.get("financial_score"),
            data.get("relational_score"),
            data.get("domain_financial"),
            data.get("domain_emotional"),
            data.get("domain_decisional"),
            data.get("domain_operational"),
            data.get("domain_relational"),
            data.get("domain_energetic"),
            json.dumps(data.get("full_result", {})),
            data.get("guidance_text")
        )
    return {"id": str(did), "pipeline_id": pid}

# ─── Memory ──────────────────────────────────────────────────

@app.get("/api/memory")
async def get_memory(user_id: str = Depends(get_current_user)):
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM user_memory WHERE user_id = $1 ORDER BY category, key",
            uuid.UUID(user_id)
        )
    return [dict(r) for r in rows]

# ─── State Classifications ───────────────────────────────────

@app.get("/api/states")
async def get_states(user_id: str = Depends(get_current_user)):
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM state_classifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20",
            uuid.UUID(user_id)
        )
    return [dict(r) for r in rows]

# ─── TTS (Grok) ─────────────────────────────────────────────

class TTSReq(BaseModel):
    text: str
    voice_id: str = "sal"

@app.post("/api/tts")
async def tts(data: TTSReq, user_id: str = Depends(get_current_user)):
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.x.ai/v1/tts",
            headers={"Authorization": f"Bearer {XAI_API_KEY}", "Content-Type": "application/json"},
            json={
                "text": data.text,
                "voice_id": data.voice_id,
                "language": "pt-BR",
                "output_format": {"codec": "mp3", "sample_rate": 24000, "bit_rate": 128000}
            },
            timeout=30
        )
    if resp.status_code != 200:
        raise HTTPException(502, "TTS failed")
    return StreamingResponse(iter([resp.content]), media_type="audio/mpeg")

# ─── Chat (Grok 4.20 with Tools) ────────────────────────────

CONSTITUTION = ""
if os.path.exists("/var/www/lifeos/api/constitution.txt"):
    with open("/var/www/lifeos/api/constitution.txt") as f:
        CONSTITUTION = f.read()

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "run_governance",
            "description": "Extract governance assessment data from conversation to run the decision engine. Call when enough data collected.",
            "parameters": {
                "type": "object",
                "properties": {
                    "assessment": {"type": "object", "properties": {"energy": {"type": "number"}, "clarity": {"type": "number"}, "stress": {"type": "number"}, "confidence": {"type": "number"}, "load": {"type": "number"}}, "required": ["energy", "clarity", "stress", "confidence", "load"]},
                    "business": {"type": "object", "properties": {"revenue": {"type": "number"}, "costs": {"type": "number"}, "founderDependence": {"type": "number"}, "activeFronts": {"type": "number"}, "processMaturity": {"type": "number"}, "delegationCapacity": {"type": "number"}}, "required": ["revenue", "costs", "founderDependence", "activeFronts", "processMaturity", "delegationCapacity"]},
                    "financial": {"type": "object", "properties": {"revenue": {"type": "number"}, "cash": {"type": "number"}, "debt": {"type": "number"}, "fixedCosts": {"type": "number"}, "intendedLeverage": {"type": "number"}}, "required": ["revenue", "cash", "debt", "fixedCosts", "intendedLeverage"]},
                    "relational": {"type": "object", "properties": {"activeConflicts": {"type": "number"}, "criticalDependencies": {"type": "number"}, "partnerAlignment": {"type": "number"}, "teamStability": {"type": "number"}, "ecosystemHealth": {"type": "number"}}, "required": ["activeConflicts", "criticalDependencies", "partnerAlignment", "teamStability", "ecosystemHealth"]},
                    "decision": {"type": "object", "properties": {"description": {"type": "string"}, "type": {"type": "string"}, "impact": {"type": "string"}, "reversibility": {"type": "string"}, "urgency": {"type": "string"}, "resourcesRequired": {"type": "string"}}, "required": ["description", "type", "impact", "reversibility", "urgency", "resourcesRequired"]}
                },
                "required": ["assessment", "business", "financial", "relational", "decision"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_memory",
            "description": "Save new insights about the user for future sessions. Call when learning something new.",
            "parameters": {
                "type": "object",
                "properties": {
                    "entries": {"type": "array", "items": {"type": "object", "properties": {"category": {"type": "string"}, "key": {"type": "string"}, "value": {"type": "string"}}, "required": ["category", "key", "value"]}}
                },
                "required": ["entries"]
            }
        }
    }
]

async def build_system_prompt(user_id: str) -> str:
    """Build dynamic system prompt from constitution + user data."""
    prompt = CONSTITUTION + "\n\n## Contexto do Usuário Atual\n"

    async with pool.acquire() as conn:
        # Profile
        profile = await conn.fetchrow("SELECT * FROM profiles WHERE id = $1", uuid.UUID(user_id))
        if profile:
            if profile["name"]:
                prompt += f"Nome: {profile['name']}\n"
            if profile["company"]:
                prompt += f"Empresa: {profile['company']}\n"
            if profile["role"]:
                prompt += f"Cargo: {profile['role']}\n"
            if profile["sector"]:
                prompt += f"Setor: {profile['sector']}\n"

        # Latest state
        state = await conn.fetchrow(
            "SELECT * FROM state_classifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
            uuid.UUID(user_id)
        )
        if state:
            prompt += f"\n## Estado Atual\nEstado: {state['state_label']} (Score: {state['overall_score']}%)\n"
            prompt += f"Energia: {state['energy']} | Clareza: {state['clarity']} | Estresse: {state['stress']} | Confiança: {state['confidence']} | Carga: {state['load']}\n"

        # Recent decisions
        decisions = await conn.fetch(
            "SELECT description, verdict, overall_score, decision_type, created_at FROM decisions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10",
            uuid.UUID(user_id)
        )
        if decisions:
            prompt += f"\n## Histórico ({len(decisions)} decisões)\n"
            for d in decisions:
                prompt += f"- [{str(d['created_at'])[:10]}] \"{str(d['description'])[:80]}\" → {d['verdict']} (score {d['overall_score']}%)\n"

        # Memory
        memories = await conn.fetch(
            "SELECT category, key, value FROM user_memory WHERE user_id = $1 ORDER BY category",
            uuid.UUID(user_id)
        )
        if memories:
            prompt += "\n## Memória Acumulada\n"
            current_cat = ""
            for m in memories:
                if m["category"] != current_cat:
                    current_cat = m["category"]
                    prompt += f"\n### {current_cat}\n"
                prompt += f"- {m['key']}: {m['value']}\n"

        if not profile and not state and not decisions and not memories:
            prompt += "(Novo usuário — sem dados)\n"

    return prompt

async def save_memory(user_id: str, entries: list):
    async with pool.acquire() as conn:
        for e in entries:
            await conn.execute(
                """INSERT INTO user_memory (user_id, category, key, value, source, updated_at)
                VALUES ($1, $2, $3, $4, 'conversation', now())
                ON CONFLICT (user_id, category, key)
                DO UPDATE SET value = $5, updated_at = now()""",
                uuid.UUID(user_id),
                e.get("category", "context"),
                e.get("key", ""),
                e.get("value", ""),
                e.get("value", "")
            )

class ChatReq(BaseModel):
    messages: list
    extractData: bool = False

@app.post("/api/chat")
async def chat(data: ChatReq, user_id: str = Depends(get_current_user)):
    system_prompt = await build_system_prompt(user_id)

    messages = [{"role": "system", "content": system_prompt}] + [
        {"role": m["role"], "content": m["content"]} for m in data.messages
    ]

    body = {"model": "grok-3-fast", "messages": messages, "max_tokens": 4096, "tools": TOOLS}

    if data.extractData:
        body["tool_choice"] = {"type": "function", "function": {"name": "run_governance"}}
        body["stream"] = False

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://api.x.ai/v1/chat/completions",
                headers={"Authorization": f"Bearer {XAI_API_KEY}", "Content-Type": "application/json"},
                json=body
            )

        if resp.status_code != 200:
            raise HTTPException(502, "Grok error")
        result = resp.json()

        # Handle tool calls — save memory if present
        tool_calls = result.get("choices", [{}])[0].get("message", {}).get("tool_calls", [])
        for tc in tool_calls:
            if tc.get("function", {}).get("name") == "update_memory":
                args = json.loads(tc["function"]["arguments"])
                await save_memory(user_id, args.get("entries", []))

        return result

    # Streaming mode
    body["stream"] = True

    async def stream_grok():
        full_response = ""
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                "https://api.x.ai/v1/chat/completions",
                headers={"Authorization": f"Bearer {XAI_API_KEY}", "Content-Type": "application/json"},
                json=body
            ) as resp:
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        json_str = line[6:].strip()
                        if json_str == "[DONE]":
                            yield "data: [DONE]\n\n"
                            break
                        try:
                            chunk = json.loads(json_str)
                            content = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                            if content:
                                full_response += content

                            # Check for tool calls in delta
                            tc = chunk.get("choices", [{}])[0].get("delta", {}).get("tool_calls")
                            if tc:
                                for t in tc:
                                    fn = t.get("function", {})
                                    if fn.get("name") == "update_memory" and fn.get("arguments"):
                                        try:
                                            args = json.loads(fn["arguments"])
                                            await save_memory(user_id, args.get("entries", []))
                                        except Exception:
                                            pass
                        except Exception:
                            pass

                        yield line + "\n"

        # Save chat history
        if full_response:
            last_user_msg = ""
            for m in reversed(data.messages):
                if m["role"] == "user":
                    last_user_msg = m["content"]
                    break
            async with pool.acquire() as conn:
                sid = uuid.uuid4()
                if last_user_msg:
                    await conn.execute(
                        "INSERT INTO chat_messages (user_id, role, content, session_id) VALUES ($1, 'user', $2, $3)",
                        uuid.UUID(user_id), last_user_msg, sid
                    )
                await conn.execute(
                    "INSERT INTO chat_messages (user_id, role, content, session_id) VALUES ($1, 'assistant', $2, $3)",
                    uuid.UUID(user_id), full_response, sid
                )

    return StreamingResponse(stream_grok(), media_type="text/event-stream")

# ─── Health ──────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "lifeos-api", "ai": "grok-4.20"}

# ─── DB Proxy (Supabase adapter compat) ──────────────────────

@app.api_route("/api/db/{table}", methods=["GET", "POST", "PUT"])
async def db_proxy(table: str, request: Request, user_id: str = Depends(get_current_user)):
    """Generic DB proxy for Supabase-compatible frontend queries."""
    ALLOWED_TABLES = {"profiles", "decisions", "state_classifications", "readiness_plans", "plan_actions", "chat_messages", "user_memory", "governance_audit_log"}
    if table not in ALLOWED_TABLES:
        raise HTTPException(400, f"Table not allowed: {table}")

    uid = uuid.UUID(user_id)
    params = dict(request.query_params)
    limit_n = int(params.pop("limit", "100"))
    order_col = params.pop("order", "created_at")

    async with pool.acquire() as conn:
        if request.method == "GET":
            # Build SELECT with user_id filter
            where_parts = ["user_id = $1"]
            values = [uid]
            idx = 2
            for k, v in params.items():
                if k in ("filter",): continue
                where_parts.append(f"{k} = ${idx}")
                values.append(v)
                idx += 1

            query = f"SELECT * FROM {table} WHERE {' AND '.join(where_parts)} ORDER BY {order_col} DESC LIMIT {limit_n}"
            rows = await conn.fetch(query, *values)
            return [dict(r) for r in rows]

        elif request.method == "POST":
            body = await request.json()
            if isinstance(body, list):
                results = []
                for item in body:
                    item["user_id"] = str(uid)
                    item.setdefault("id", str(uuid.uuid4()))
                    cols = list(item.keys())
                    placeholders = ", ".join(f"${i+1}" for i in range(len(cols)))
                    col_names = ", ".join(cols)
                    vals = []
                    for c in cols:
                        v = item[c]
                        if c in ("id", "user_id", "decision_id", "plan_id", "session_id"):
                            v = uuid.UUID(str(v)) if v else None
                        elif isinstance(v, dict) or isinstance(v, list):
                            v = json.dumps(v)
                        vals.append(v)
                    try:
                        await conn.execute(f"INSERT INTO {table} ({col_names}) VALUES ({placeholders})", *vals)
                        results.append(item)
                    except Exception as e:
                        results.append({"error": str(e)})
                return results
            else:
                body["user_id"] = str(uid)
                body.setdefault("id", str(uuid.uuid4()))
                cols = list(body.keys())
                placeholders = ", ".join(f"${i+1}" for i in range(len(cols)))
                col_names = ", ".join(cols)
                vals = []
                for c in cols:
                    v = body[c]
                    if c in ("id", "user_id", "decision_id", "plan_id", "session_id"):
                        v = uuid.UUID(str(v)) if v else None
                    elif isinstance(v, dict) or isinstance(v, list):
                        v = json.dumps(v)
                    vals.append(v)
                await conn.execute(f"INSERT INTO {table} ({col_names}) VALUES ({placeholders})", *vals)
                return body

        elif request.method == "PUT":
            body = await request.json()
            sets = []
            vals = [uid]
            idx = 2
            for k, v in body.items():
                if k in ("id", "user_id"): continue
                if isinstance(v, dict) or isinstance(v, list):
                    v = json.dumps(v)
                sets.append(f"{k} = ${idx}")
                vals.append(v)
                idx += 1

            # Get target ID from query params
            target_id = params.get("id")
            if target_id:
                where = f"user_id = $1 AND id = ${idx}"
                vals.append(uuid.UUID(target_id))
            else:
                where = "user_id = $1"

            await conn.execute(f"UPDATE {table} SET {', '.join(sets)} WHERE {where}", *vals)
            return {"status": "ok"}

# ─── RPC (Supabase RPC compat) ───────────────────────────────

@app.post("/api/rpc/{fn}")
async def rpc_proxy(fn: str, request: Request, user_id: str = Depends(get_current_user)):
    """RPC proxy for Supabase-compatible frontend calls."""
    body = await request.json()
    uid = uuid.UUID(user_id)

    if fn == "get_capacity_trend":
        limit_n = body.get("p_limit", 10)
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT created_at, overall_score, state_id, classification_confidence FROM state_classifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
                uid, limit_n
            )
        return [dict(r) for r in rows]

    raise HTTPException(404, f"Unknown RPC: {fn}")

# ─── Functions (Supabase Edge Functions compat) ──────────────

@app.post("/api/fn/{fn}")
async def fn_proxy(fn: str, request: Request, user_id: str = Depends(get_current_user)):
    """Edge function proxy."""
    if fn == "channel-status":
        return {"telegram": {"connected": False}, "whatsapp": {"connected": False}}
    if fn == "elevenlabs-scribe-token":
        return {"token": ""}
    raise HTTPException(404, f"Unknown function: {fn}")
