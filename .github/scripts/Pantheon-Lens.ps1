<#
.SYNOPSIS
    Pantheon-Lens - a single-file, zero-dependency live dashboard for the Pantheon
    multi-agent system. 

.DESCRIPTION
    Drop this one .ps1 file into the same workspace as your Pantheon agents and run it.
    It starts a tiny local web server (built-in .NET HttpListener), parses the Pantheon
    coordination files under .github/pantheon-temp/ and .github/pantheon-worklog/, and
    serves a live dashboard (Overview, Agent Map, Pipeline, Communications, Worklog,
    Decisions) that auto-refreshes as the agents work.

    IMPORTANT: Save this file as UTF-8 with BOM so Windows PowerShell 5.1 keeps the
    em-dashes / arrows intact.

.PARAMETER WorkspacePath
    Root of the workspace that contains the .github/pantheon-temp folder.
    Defaults to the current directory.

.PARAMETER Port
    Local port to serve the dashboard on. Default: 7878.

.PARAMETER NoBrowser
    Do not auto-open the browser.

.EXAMPLE
    .\Pantheon-Lens.ps1
    Serves the dashboard for the current workspace at http://localhost:7878

.EXAMPLE
    .\Pantheon-Lens.ps1 -WorkspacePath "D:\my-project" -Port 9000
#>

[CmdletBinding()]
param(
    [string]$WorkspacePath = (Get-Location).Path,
    [int]$Port = 7878,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
try { [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false) } catch {}

# ─────────────────────────────────────────────────────────────
# Resolve coordination paths
# ─────────────────────────────────────────────────────────────
$WorkspacePath = (Resolve-Path $WorkspacePath).Path
$script:TempDir    = Join-Path $WorkspacePath '.github\pantheon-temp'
$script:WorklogDir = Join-Path $WorkspacePath '.github\pantheon-worklog'

$canonicalAgents = @(
    'Zeus - Orchestrator',
    'Hermes - JiraRetriever',
    'Prometheus - Developer',
    'Themis - Test Engineer',
    'Charon - GitMaster',
    'Metis - Reviewer'
)

# ─────────────────────────────────────────────────────────────
# Agent portrait images (base64; empty string if folder absent)
# ─────────────────────────────────────────────────────────────
$script:ImgDir = Join-Path $WorkspacePath 'pantheon\marketing\Images'
function Load-Img([string]$n) {
    $p = Join-Path $script:ImgDir "$n.png"
    if (Test-Path -LiteralPath $p) { try { return [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($p)) } catch {} }
    return ''
}
$script:ImgZeus       = Load-Img 'Zeus'
$script:ImgHermes     = Load-Img 'Hermes'
$script:ImgPrometheus = Load-Img 'Prometheus'
$script:ImgThemis     = Load-Img 'Themis'
$script:ImgCharon     = Load-Img 'Charon'
$script:ImgMetis      = Load-Img 'Metis'
$script:ImgHarmonia   = Load-Img 'Harmonia'

# ─────────────────────────────────────────────────────────────
# Safe file reader (tolerates files being written by an agent)
# ─────────────────────────────────────────────────────────────
function Read-FileSafe {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    for ($i = 0; $i -lt 4; $i++) {
        try {
            $fs = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
            try {
                $sr = New-Object System.IO.StreamReader($fs, [System.Text.Encoding]::UTF8)
                return $sr.ReadToEnd()
            } finally { $fs.Dispose() }
        } catch {
            Start-Sleep -Milliseconds 60
        }
    }
    return $null
}

# ─────────────────────────────────────────────────────────────
# Parsers
# ─────────────────────────────────────────────────────────────
function Get-AgentStates {
    $content = Read-FileSafe (Join-Path $script:TempDir 'agent-states.md')
    $map = [ordered]@{}
    if ($content) {
        foreach ($line in ($content -split "`r?`n")) {
            if ($line -match '^\s*(.+?)\s*:\s*(WORKING|IDLE)\s*$') {
                $map[$matches[1].Trim()] = $matches[2].Trim().ToUpper()
            }
        }
    }
    return $map
}

function Get-ModelConfig {
    $content = Read-FileSafe (Join-Path $script:TempDir 'session-model-config.md')
    $map = @{}
    if ($content) {
        foreach ($line in ($content -split "`r?`n")) {
            # Extract ProjectName field
            if ($line -match '^\s*\*\*ProjectName:?\*\*\s*[:]?\s*(.+)$') {
                $map['__projectName__'] = $matches[1].Trim()
                continue
            }
            if ($line -match '^\s*\|(.+?)\|(.+?)\|\s*$') {
                $agent = $matches[1].Trim().Trim('`').Trim()
                $model = $matches[2].Trim().Trim('`').Trim()
                if ($agent -in @('Agent', '---', '') -or $agent -match '^-+$') { continue }
                $map[$agent] = $model
            }
        }
    }
    return $map
}

function Get-JiraItems {
    $content = Read-FileSafe (Join-Path $script:TempDir 'jira-items.md')
    $items = @()
    if (-not $content) { return $items }
    $current = $null
    foreach ($line in ($content -split "`r?`n")) {
        if ($line -match '^\s*##\s*\[?([A-Za-z0-9][A-Za-z0-9_\-]*)\]?\s*:?\s*$') {
            if ($current) { $items += $current }
            $current = [ordered]@{ key = $matches[1].Trim(); title = ''; status = 'RETRIEVED'; link = ''; description = ''; projectName = ''; timestamp = ''; failureType = ''; issues = @() }
            continue
        }
        if (-not $current) { continue }
        if     ($line -match '^\s*\*\*Title\*\*\s*[-:]?\s*(.+)$')       { $current.title       = $matches[1].Trim() }
        elseif ($line -match '^\s*\*\*Status:?\*\*\s*[:]?\s*(.+)$')     { $current.status      = ($matches[1].Trim() -split '\s')[0].Trim().ToUpper() }
        elseif ($line -match '^\s*\*\*Link:?\*\*\s*[:]?\s*(.+)$')       { $current.link        = $matches[1].Trim() }
        elseif ($line -match '^\s*\*\*Description:?\*\*\s*[:]?\s*(.+)$') { $current.description = $matches[1].Trim() }
        elseif ($line -match '^\s*\*\*ProjectName:?\*\*\s*[:]?\s*(.+)$') { $current.projectName = $matches[1].Trim() }
        elseif ($line -match '^\s*\*\*Timestamp:?\*\*\s*[:]?\s*(.+)$')   { $current.timestamp   = $matches[1].Trim() }
        elseif ($line -match '^\s*\*\*Failure Type:?\*\*\s*[:]?\s*(.+)$'){ $current.failureType = $matches[1].Trim() }
        elseif ($line -match '^\s*-\s*\[Issue[:\]]\s*(.+)$')            { $current.issues += $matches[1].Trim(' ]') }
    }
    if ($current) { $items += $current }
    return $items
}

function Get-Communications {
    $content = Read-FileSafe (Join-Path $script:TempDir 'communications.md')
    $entries = @()
    if (-not $content) { return $entries }
    $seq = 0
    foreach ($line in ($content -split "`r?`n")) {
        # New format: [TIMESTAMP] [PROJECT-NAME] [TASK-ID] Agent: Message
        if ($line -match '^\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*([^:]+?)\s*:\s*(.+)$') {
            $seq++
            $entries += [ordered]@{
                seq         = $seq
                timestamp   = $matches[1].Trim()
                projectName = $matches[2].Trim()
                taskId      = $matches[3].Trim()
                agent       = $matches[4].Trim()
                message     = $matches[5].Trim()
            }
        }
        # Legacy format: [TASK-ID] Agent: Message
        elseif ($line -match '^\s*\[([^\]]+)\]\s*([^:]+?)\s*:\s*(.+)$') {
            $seq++
            $entries += [ordered]@{
                seq         = $seq
                timestamp   = ''
                projectName = ''
                taskId      = $matches[1].Trim()
                agent       = $matches[2].Trim()
                message     = $matches[3].Trim()
            }
        }
    }
    return $entries
}

function Get-Decisions {
    $content = Read-FileSafe (Join-Path $script:TempDir 'key-decisions.md')
    $entries = @()
    if (-not $content) { return $entries }
    foreach ($line in ($content -split "`r?`n")) {
        # New format: [TIMESTAMP] [PROJECT-NAME] [Task ID] - [TYPE]: Description
        if ($line -match '^\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[?([A-Za-z0-9][A-Za-z0-9_\-]*)\]?\s*-\s*([A-Z][A-Z \-/]+?)\s*:\s*(.+)$') {
            $entries += [ordered]@{
                timestamp   = $matches[1].Trim()
                projectName = $matches[2].Trim()
                taskId      = $matches[3].Trim()
                type        = $matches[4].Trim()
                description = $matches[5].Trim()
            }
        }
        # Legacy format: [Task ID] - [TYPE]: Description
        elseif ($line -match '^\s*\[?([A-Za-z0-9][A-Za-z0-9_\-]*)\]?\s*-\s*([A-Z][A-Z \-/]+?)\s*:\s*(.+)$') {
            $entries += [ordered]@{
                timestamp   = ''
                projectName = ''
                taskId      = $matches[1].Trim()
                type        = $matches[2].Trim()
                description = $matches[3].Trim()
            }
        }
    }
    return $entries
}

function Get-Worklog {
    $path = Join-Path $script:WorklogDir 'worklog.jsonl'
    $content = Read-FileSafe $path
    $entries = @()
    if (-not $content) { return $entries }
    foreach ($line in ($content -split "`r?`n")) {
        $t = $line.Trim()
        if ($t.Length -lt 2 -or $t[0] -ne '{') { continue }
        try {
            $obj = $t | ConvertFrom-Json
            $entries += $obj
        } catch { }
    }
    return $entries
}

function Get-PantheonState {
    $states = Get-AgentStates
    $models = Get-ModelConfig
    $tasks  = Get-JiraItems
    $comms  = Get-Communications
    $decs   = Get-Decisions
    $work   = Get-Worklog

    # Build agent list: canonical roster + any discovered names, in a stable order
    $names = @()
    foreach ($n in $canonicalAgents) { if (-not ($names -contains $n)) { $names += $n } }
    foreach ($n in $states.Keys)     { if (-not ($names -contains $n)) { $names += $n } }

    $agents = @()
    foreach ($n in $names) {
        $st = if ($states.Contains($n)) { $states[$n] } else { 'IDLE' }
        $md = if ($models.ContainsKey($n)) { $models[$n] } else { '' }
        $agents += [ordered]@{ name = $n; status = $st; model = $md }
    }

    return [ordered]@{
        agents        = $agents
        tasks         = $tasks
        communications= $comms
        decisions     = $decs
        worklog       = $work
        projectName   = if ($models.ContainsKey('__projectName__')) { $models['__projectName__'] } else { '' }
        lastUpdated   = (Get-Date).ToString('o')
        workspace     = $WorkspacePath
        connected     = (Test-Path -LiteralPath $script:TempDir)
    }
}

# ─────────────────────────────────────────────────────────────
# Embedded dashboard (single-quoted here-string -> no PS expansion)
# ─────────────────────────────────────────────────────────────
$script:Html = @'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Pantheon-Lens</title>
<style>
  :root{
    --bg:#0a0c14;--bg2:#0f1220;--bg3:#141828;--card:#181d2e;--card2:#1b2236;--border:#252d45;
    --accent:#7c6ef0;--accent2:#a78bfa;--gold:#f5c842;--cyan:#38bdf8;--green:#4ade80;
    --orange:#fb923c;--red:#f87171;--pink:#f472b6;--text:#e2e8f0;--text2:#94a3b8;--text3:#64748b;
    --radius:12px;--radius-lg:20px;
  }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',system-ui,sans-serif;background:radial-gradient(1200px 800px at 80% -10%,#16193080,transparent),var(--bg);color:var(--text);min-height:100vh}
  a{color:var(--cyan);text-decoration:none}
  header{display:flex;align-items:center;gap:16px;padding:16px 24px;border-bottom:1px solid var(--border);background:#0c0f1ccc;backdrop-filter:blur(8px);position:sticky;top:0;z-index:20}
  .logo{font-size:20px;font-weight:800;letter-spacing:.5px;background:linear-gradient(90deg,var(--accent2),var(--cyan));-webkit-background-clip:text;background-clip:text;color:transparent}
  .logo small{font-weight:500;color:var(--text3);-webkit-text-fill-color:var(--text3)}
  .live{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--text2);margin-left:auto}
  .dot{width:9px;height:9px;border-radius:50%;background:var(--green);box-shadow:0 0 10px var(--green);animation:pulse 1.6s infinite}
  .dot.off{background:var(--red);box-shadow:0 0 10px var(--red);animation:none}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
  nav{display:flex;gap:4px;padding:10px 24px;border-bottom:1px solid var(--border);flex-wrap:wrap;background:#0a0c14cc}
  .tab{padding:8px 16px;border-radius:10px;font-size:14px;font-weight:600;color:var(--text2);cursor:pointer;border:1px solid transparent;transition:.15s}
  .tab:hover{color:var(--text);background:#ffffff08}
  .tab.active{color:#fff;background:var(--accent);border-color:var(--accent2)}
  main{padding:24px;max-width:1400px;margin:0 auto}
  .grid{display:grid;gap:16px}
  .kpis{grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}
  .card{background:linear-gradient(180deg,var(--card),var(--bg2));border:1px solid var(--border);border-radius:var(--radius);padding:18px}
  .kpi .v{font-size:34px;font-weight:800;line-height:1}
  .kpi .l{font-size:13px;color:var(--text2);margin-top:8px}
  .kpi .s{font-size:11px;color:var(--text3);margin-top:3px}
  h2{font-size:15px;text-transform:uppercase;letter-spacing:1px;color:var(--text2);margin:28px 0 12px}
  h2:first-child{margin-top:0}
  .funnel{display:flex;flex-direction:column;gap:8px}
  .frow{display:grid;grid-template-columns:130px 1fr 40px;align-items:center;gap:10px;font-size:13px}
  .bar{height:22px;border-radius:6px;background:linear-gradient(90deg,var(--accent),var(--cyan));min-width:2px}
  .feed{display:flex;flex-direction:column;gap:6px;max-height:420px;overflow:auto}
  .msg{padding:8px 12px;border-radius:8px;background:#ffffff05;border-left:3px solid var(--accent);font-size:13px}
  .msg .who{font-weight:700}
  .msg .tag{font-size:11px;color:var(--text3);margin-right:6px}
  /* agent map */
  .map{position:relative;min-height:540px;padding:10px}
  .map svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
  .node{position:absolute;transform:translate(-50%,-50%);background:var(--card2);border:2px solid var(--border);border-radius:14px;padding:12px 14px;width:190px;text-align:center;transition:.25s;z-index:2}
  .node.working{border-color:var(--cyan);box-shadow:0 0 22px #38bdf855;background:#13233a}
  .node.zeus{border-color:var(--gold)}
  .node.zeus.working{border-color:var(--gold);box-shadow:0 0 26px #f5c84255}
  .node .nm{font-weight:700;font-size:14px}
  .node .md{font-size:11px;color:var(--text3);margin-top:4px}
  .node .badge{display:inline-block;margin-top:7px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;letter-spacing:.5px}
  .badge.WORKING{background:#0e2a3f;color:var(--cyan)}
  .badge.IDLE{background:#1c2336;color:var(--text3)}
  /* kanban */
  .kanban{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(150px,1fr);gap:10px;overflow-x:auto;padding-bottom:8px}
  .col{background:#ffffff05;border:1px solid var(--border);border-radius:10px;padding:8px;min-height:120px}
  .col h3{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--text2);margin-bottom:8px;display:flex;justify-content:space-between}
  .col h3 .c{background:#ffffff12;border-radius:10px;padding:0 7px}
  .tcard{background:var(--card2);border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:8px;padding:8px;margin-bottom:7px;font-size:12px}
  .tcard.done{border-left-color:var(--green)}
  .tcard.lock{border-left-color:var(--cyan)}
  .tcard.fail{border-left-color:var(--red)}
  .tcard .id{font-weight:700;color:var(--accent2)}
  .tcard .tt{color:var(--text2);margin-top:3px}
  /* table */
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--border);vertical-align:top}
  th{color:var(--text2);font-size:11px;text-transform:uppercase;letter-spacing:.5px;position:sticky;top:0;background:var(--bg2)}
  tr:hover td{background:#ffffff04}
  .pill{display:inline-block;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:#ffffff10}
  .st-success{color:var(--green)} .st-partial{color:var(--gold)} .st-blocked{color:var(--orange)} .st-failed{color:var(--red)}
  /* worklog gantt */
  .gantt{display:flex;flex-direction:column;gap:6px}
  .grow{display:grid;grid-template-columns:160px 1fr;gap:10px;align-items:center;font-size:12px}
  .track{position:relative;height:26px;background:#ffffff05;border-radius:6px;overflow:hidden}
  .gbar{position:absolute;top:3px;height:20px;border-radius:5px;min-width:6px;display:flex;align-items:center;padding:0 6px;font-size:10px;color:#06120a;font-weight:700;white-space:nowrap;overflow:hidden}
  .filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
  .filters input,.filters select{background:var(--card2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px 10px;font-size:13px}
  .chip{font-size:11px;padding:4px 10px;border-radius:20px;border:1px solid var(--border);background:#ffffff05;color:var(--text2);cursor:pointer}
  .chip.on{background:var(--accent);color:#fff;border-color:var(--accent2)}
  .empty{color:var(--text3);font-style:italic;padding:30px;text-align:center}
  .two{display:grid;grid-template-columns:1.4fr 1fr;gap:16px}
  @media(max-width:900px){.two{grid-template-columns:1fr}}
  .scroll{max-height:520px;overflow:auto}
  /* agent roster cards (overview) */
  .ag-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;max-height:480px;overflow:auto}
  .ag-card{display:flex;gap:12px;align-items:center;background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:12px;transition:.2s}
  .ag-card.working{border-color:var(--cyan);box-shadow:0 0 14px #38bdf830;background:#0c1e2e}
  .ag-portrait{width:54px;height:54px;border-radius:50%;object-fit:cover;object-position:top center;border:2px solid var(--border);flex-shrink:0}
  .ag-portrait.working{border-color:var(--cyan)}
  .ag-portrait-placeholder{width:54px;height:54px;border-radius:50%;background:var(--bg3);border:2px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--text3)}
  .ag-info{flex:1;min-width:0}
  .ag-name{font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ag-role{font-size:11px;color:var(--text3);margin-top:2px;margin-bottom:6px}
  .ag-model-txt{font-size:10px;color:var(--text3);margin-top:4px}
  /* map node portrait */
  .node-img{width:64px;height:64px;border-radius:50%;object-fit:cover;object-position:top center;margin:0 auto 8px;display:block;border:2px solid var(--border)}
  .node.working .node-img{border-color:var(--cyan)}
  .node.zeus .node-img{border-color:var(--gold)}
</style>
</head>
<body>
<header>
  <div class="logo">PANTHEON&middot;LENS <small id="ws"></small></div>
  <div class="live"><span id="dot" class="dot"></span><span id="livetxt">connecting&hellip;</span></div>
</header>
<nav id="nav"></nav>
<main id="view"></main>

<script>
const TABS=['Overview','Agent Map','Pipeline','Communications','Worklog','Decisions','Cost Estimation','Pricing'];
const STAGES=['RETRIEVED','TODO','IMPLEMENTING','IMPLEMENTED','TESTING','TESTED','PUSHING','PUSHED','REVIEWING','REVIEWED'];
const LOCK=['IMPLEMENTING','TESTING','PUSHING','REVIEWING'];
// Model pricing per 1,000,000 tokens: [input $/1M, output $/1M].
// Ordered most-specific-first so substring matching picks the right tier.
const MODEL_COSTS={
  // OpenAI
  'gpt-5 mini':[0.25,2.00],'gpt-5.4 mini':[0.75,4.50],'gpt-5.4 nano':[0.20,1.25],
  'gpt-5.2-codex':[1.75,14.00],'gpt-5.3-codex':[1.75,14.00],
  'gpt-5.2':[1.75,14.00],'gpt-5.4':[2.50,15.00],'gpt-5.5':[5.00,30.00],'gpt-5':[1.75,14.00],
  // Anthropic
  'claude haiku 4.5':[1.00,5.00],'claude haiku':[1.00,5.00],
  'claude sonnet 4.6':[3.00,15.00],'claude sonnet 4.5':[3.00,15.00],'claude sonnet 4':[3.00,15.00],'claude sonnet':[3.00,15.00],
  'claude opus 4.8':[5.00,25.00],'claude opus 4.7':[5.00,25.00],'claude opus 4.6':[5.00,25.00],'claude opus 4.5':[5.00,25.00],'claude opus':[5.00,25.00],
  // Google
  'gemini 2.5 pro':[1.25,10.00],'gemini 3 flash':[0.50,3.00],'gemini 3.1 pro':[2.00,12.00],'gemini 3.5 flash':[1.50,9.00],
  // Fine-tuned (GitHub)
  'raptor mini':[0.25,2.00],
  // Microsoft
  'mai-code-1-flash':[0.75,4.50],
};
const USD_PER_CREDIT=0.01; // 1 AI credit = $0.01 USD
function modelCostPerMTok(model){
  const m=(model||'').toLowerCase();
  const entry=Object.entries(MODEL_COSTS).find(([k])=>m.includes(k));
  return entry?entry[1]:[3.00,15.00];
}
function estimateCost(entry){
  const ctxTok=Math.ceil(+(entry.contextSize||0)/4);
  const ioTok=Math.ceil(+(entry.totalInputOutputSize||0)/4);
  const outTok=Math.max(0,ioTok-ctxTok);
  const [inPM,outPM]=modelCostPerMTok(entry.model);
  return (ctxTok/1e6)*inPM+(outTok/1e6)*outPM;
}
function estimateCredits(entry){ return estimateCost(entry)/USD_PER_CREDIT; }
const AGENT_META={
  zeus:      {role:'Lead Technical Program Manager',   color:'var(--gold)',    img:'__ZEUS__'},
  hermes:    {role:'Senior Integration Specialist',    color:'var(--cyan)',    img:'__HERMES__'},
  prometheus:{role:'Senior Software Engineer',         color:'var(--orange)',  img:'__PROMETHEUS__'},
  themis:    {role:'Senior QA / Test Engineer',        color:'var(--pink)',    img:'__THEMIS__'},
  charon:    {role:'Senior Release Engineer',          color:'var(--green)',   img:'__CHARON__'},
  metis:     {role:'Senior Code Reviewer',             color:'var(--red)',     img:'__METIS__'},
  harmonia:  {role:'Dashboard Operator',               color:'var(--accent2)', img:'__HARMONIA__'},
};
function agentMeta(name){
  const k=name?Object.keys(AGENT_META).find(k=>name.toLowerCase().includes(k)):null;
  return k?AGENT_META[k]:{role:'',color:'var(--text2)',img:''};
}
let active='Overview', state=null;
const f={
  comAgent:'',comTask:'',comProject:'',comSearch:'',comSort:'seq',comDir:-1,
  wkAgent:'',wkStatus:'',wkTask:'',wkProject:'',wkSort:'timestamp',wkDir:-1,
  decType:'',decProject:'',decTask:'',decSort:'taskId',decDir:1,
  costProject:'',costWorkingTask:'',costAgent:'',costModel:'',costFrom:'',costTo:'',costSort:'timestamp',costDir:-1,
  pipeProject:'',pipeStatus:'',pipeSearch:'',pipeSort:'key',pipeDir:1
};

const nav=document.getElementById('nav');
TABS.forEach(t=>{const d=document.createElement('div');d.className='tab'+(t===active?' active':'');d.textContent=t;d.onclick=()=>{active=t;render();[...nav.children].forEach(c=>c.classList.toggle('active',c.textContent===t))};nav.appendChild(d)});

function esc(s){return (s==null?'':String(s)).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}
function hue(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))%360;return h}
function agentColor(s){return `hsl(${hue(s||'x')},65%,62%)`}
function durMs(d){if(!d)return 0;let m=0;const h=/(\d+)\s*h/.exec(d),mi=/(\d+)\s*m/.exec(d),s=/(\d+)\s*s/.exec(d);if(h)m+=+h[1]*3600000;if(mi)m+=+mi[1]*60000;if(s)m+=+s[1]*1000;return m}
function tokens(t){return Math.ceil((t||'').length/4)}

let lastSig=null;
// PowerShell ConvertTo-Json collapses single-element arrays into a single
// object and empty arrays into {} — coerce everything back to a real array.
function A(x){
  if(Array.isArray(x))return x;
  if(x==null)return [];
  if(typeof x==='object'){return Object.keys(x).length?[x]:[]}
  return [];
}
function normalize(s){
  if(!s)return s;
  s.agents=A(s.agents);
  s.tasks=A(s.tasks);
  s.communications=A(s.communications);
  s.decisions=A(s.decisions);
  s.worklog=A(s.worklog);
  s.tasks.forEach(t=>{t.issues=A(t.issues)});
  s.worklog.forEach(w=>{
    // Normalize workingTaskId (new) or taskId (old) to workingTaskId array
    const tid=w.workingTaskId!=null?w.workingTaskId:(w.taskId!=null?w.taskId:[]);
    w.workingTaskId=Array.isArray(tid)?tid:(tid!==''&&tid!=null?[String(tid)]:[]);
    // Normalize projectName (new) or serviceName (old)
    if(!w.projectName)w.projectName=w.serviceName||'';
  });
  s.communications.forEach((c,i)=>{if(c.seq==null)c.seq=i+1;});
  return s;
}
function dataSig(s){
  // cheap signature of everything the views render, ignoring lastUpdated timestamp
  return JSON.stringify({a:s.agents,t:s.tasks,c:s.communications,d:s.decisions,w:s.worklog,k:s.connected});
}
function interacting(){
  // don't blow away the DOM while the user is using a control inside the view
  const el=document.activeElement;
  if(!el)return false;
  const tag=el.tagName;
  return (tag==='SELECT'||tag==='INPUT'||tag==='OPTION') && el.closest('#view')!==null;
}

// ── Sort utilities ────────────────────────────────────────────────────────────
function sortArr(arr,col,dir){
  if(!col)return arr;
  return arr.slice().sort((a,b)=>{
    let va=a[col],vb=b[col];
    if(va==null)va=''; if(vb==null)vb='';
    if(typeof va==='number'&&typeof vb==='number')return(va-vb)*dir;
    if(Array.isArray(va))va=va.join(','); if(Array.isArray(vb))vb=vb.join(',');
    return String(va).localeCompare(String(vb),undefined,{numeric:true})*dir;
  });
}
function sortBy(tab,col){
  if(f[tab+'Sort']===col){f[tab+'Dir']*=-1;}else{f[tab+'Sort']=col;f[tab+'Dir']=1;}
  render();
}
function sortTh(label,tab,col,extra=''){
  const active=f[tab+'Sort']===col;
  const arrow=active?(f[tab+'Dir']===1?'&#8593;':'&#8595;'):'&#8597;';
  const color=active?'var(--accent2)':'var(--text3)';
  return `<th style="cursor:pointer;user-select:none;${extra}" onclick="sortBy('${tab}','${col}')">${esc(label)}&thinsp;<span style="color:${color};font-size:10px">${arrow}</span></th>`;
}
function sortPipeStatus(s){f.pipeStatus=s;render();}

async function poll(){
  try{
    const r=await fetch('/api/state',{cache:'no-store'});
    const next=await r.json();
    state=normalize(next);
    const ok=state.connected;
    document.getElementById('dot').className='dot'+(ok?'':' off');
    document.getElementById('livetxt').innerHTML=ok?('live &middot; '+new Date(state.lastUpdated).toLocaleTimeString()):'no pantheon-temp folder found';
    const proj=state.projectName?(' &mdash; '+esc(state.projectName)):'';
    const ws=state.workspace?state.workspace.split(/[\\/]/).pop():'';
    document.getElementById('ws').innerHTML=proj||(ws?' &mdash; '+esc(ws):'');
    const sig=dataSig(state);
    // only re-render when the underlying data changed AND the user isn't mid-interaction
    if(sig!==lastSig && !interacting()){
      lastSig=sig;
      render();
    }
  }catch(e){
    document.getElementById('dot').className='dot off';
    document.getElementById('livetxt').textContent='server offline';
  }
}

function render(){
  const v=document.getElementById('view');
  if(!state){v.innerHTML='<div class="empty">Loading&hellip;</div>';return}
  if(active==='Overview')v.innerHTML=vOverview();
  else if(active==='Agent Map')v.innerHTML=vMap();
  else if(active==='Pipeline'){v.innerHTML=vPipeline();bindPipeline()}
  else if(active==='Communications'){v.innerHTML=vComms();bindComms()}
  else if(active==='Worklog'){v.innerHTML=vWorklog();bindWork()}
  else if(active==='Decisions'){v.innerHTML=vDecisions();bindDec()}
  else if(active==='Cost Estimation'){v.innerHTML=vCost();bindCost()}
  else if(active==='Pricing')v.innerHTML=vPricing();
}

function vOverview(){
  const tasks=state.tasks||[],agents=state.agents||[],work=state.worklog||[],comms=state.communications||[];
  const activeTasks=tasks.filter(t=>!['PUSHED','REVIEWED'].includes(t.status)).length;
  const working=agents.filter(a=>a.status==='WORKING').length;
  const done=tasks.filter(t=>['PUSHED','REVIEWED'].includes(t.status)).length;
  const pct=tasks.length?Math.round(done/tasks.length*100):0;
  const succ=work.filter(w=>w.status==='success').length;
  const sr=work.length?Math.round(succ/work.length*100):0;
  const estTok=work.reduce((s,x)=>s+Math.ceil(+(x.totalInputOutputSize||0)/4),0);
  const last=comms.slice(-12).reverse().map(c=>`<div class="msg" style="border-left-color:${c.taskId==='PIPELINE'?'var(--text3)':agentColor(c.agent)}"><span class="tag">[${esc(c.taskId)}]</span><span class="who" style="color:${agentColor(c.agent)}">${esc(c.agent)}</span>: ${esc(c.message)}</div>`).join('')||'<div class="empty">No communications yet</div>';
  const agCards=agents.map(a=>{
    const m=agentMeta(a.name);
    const imgEl=m.img
      ?`<img class="ag-portrait${a.status==='WORKING'?' working':''}" src="data:image/png;base64,${m.img}" alt="${esc(a.name)}"></img>`
      :`<div class="ag-portrait-placeholder">&#9733;</div>`;
    return `<div class="ag-card${a.status==='WORKING'?' working':''}">
      ${imgEl}
      <div class="ag-info">
        <div class="ag-name" style="color:${m.color}">${esc(a.name)}</div>
        <div class="ag-role">${esc(m.role)}</div>
        <div class="badge ${a.status}">${a.status}</div>
        ${a.model?`<div class="ag-model-txt">${esc(a.model)}</div>`:''}
      </div>
    </div>`;
  }).join('')||'<div class="empty">No agents registered</div>';
  return `
  <div class="grid kpis">
    <div class="card kpi"><div class="v" style="color:var(--accent2)">${activeTasks}</div><div class="l">Active Tasks</div><div class="s">${tasks.length} total</div></div>
    <div class="card kpi"><div class="v" style="color:var(--cyan)">${working}</div><div class="l">Agents Working</div><div class="s">${agents.length} registered</div></div>
    <div class="card kpi"><div class="v" style="color:var(--green)">${pct}%</div><div class="l">Pipeline Complete</div><div class="s">${done} shipped</div></div>
    <div class="card kpi"><div class="v" style="color:var(--gold)">${sr}%</div><div class="l">Worklog Success</div><div class="s">${work.length} runs</div></div>
    <div class="card kpi"><div class="v" style="color:var(--pink);font-size:22px">${estTok.toLocaleString()}</div><div class="l">I/O Tokens (total)</div><div class="s">totalInputOutputSize&divide;4</div></div>
  </div>
  <div class="two" style="margin-top:18px">
    <div class="card"><h2 style="margin-top:0">Meet the Agents</h2><div class="ag-grid">${agCards}</div></div>
    <div class="card"><h2 style="margin-top:0">Last Activity</h2><div class="feed">${last}</div></div>
  </div>`;
}

function vMap(){
  const agents=state.agents||[];
  const zeus=agents.find(a=>/zeus/i.test(a.name));
  const subs=agents.filter(a=>!/zeus/i.test(a.name));
  const cx=50, zy=14;
  let edges='',nodes='';
  if(zeus){
    nodes+=node(zeus,cx,zy,true);
  }
  subs.forEach((a,i)=>{
    const x= subs.length===1?50: 8+ (84*i/(subs.length-1));
    const y= 68;
    edges+=`<line x1="${cx}%" y1="${zy+8}%" x2="${x}%" y2="${y-8}%" stroke="${a.status==='WORKING'?'#38bdf8':'#2a3350'}" stroke-width="${a.status==='WORKING'?2:1}" />`;
    nodes+=node(a,x,y,false);
  });
  return `<div class="card"><h2 style="margin-top:0">Agent Map &mdash; Zeus delegates to specialists (live)</h2>
    <div class="map"><svg>${edges}</svg>${nodes}</div></div>`;
  function node(a,x,y,isZeus){
    const m=agentMeta(a.name);
    const cls='node'+(isZeus?' zeus':'')+(a.status==='WORKING'?' working':'');
    const imgEl=m.img?`<img class="node-img" src="data:image/png;base64,${m.img}" alt="${esc(a.name)}">`:
      `<div style="width:64px;height:64px;border-radius:50%;background:var(--bg3);border:2px solid var(--border);margin:0 auto 8px;display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--text3)">&#9733;</div>`;
    return `<div class="${cls}" style="left:${x}%;top:${y}%;width:200px">
      ${imgEl}
      <div class="nm" style="color:${m.color}">${esc(a.name)}</div>
      <div class="md">${esc(a.model||'&mdash;')}</div>
      <div class="badge ${a.status}">${a.status}</div></div>`;
  }
}


function vComms(){
  let c=state.communications||[];
  const agents=[...new Set(c.map(x=>x.agent))];
  const tasks=[...new Set(c.map(x=>x.taskId))];
  const projects=[...new Set(c.map(x=>x.projectName||'').filter(Boolean))];
  if(f.comAgent)c=c.filter(x=>x.agent===f.comAgent);
  if(f.comTask)c=c.filter(x=>x.taskId===f.comTask);
  if(f.comProject)c=c.filter(x=>(x.projectName||'')===f.comProject);
  if(f.comSearch)c=c.filter(x=>(x.message||'').toLowerCase().includes(f.comSearch.toLowerCase())||(x.agent||'').toLowerCase().includes(f.comSearch.toLowerCase()));
  c=sortArr(c,f.comSort,f.comDir);
  const rows=c.map(x=>`<tr>
    <td style="font-family:monospace;font-size:11px;white-space:nowrap">${esc(x.timestamp?new Date(x.timestamp).toLocaleString():('#'+x.seq))}</td>
    <td style="font-size:11px;color:var(--text3)">${esc(x.projectName||'')}</td>
    <td><span class="pill" style="border-left:3px solid ${x.taskId==='PIPELINE'?'var(--text3)':agentColor(x.agent)}">${esc(x.taskId)}</span></td>
    <td style="color:${agentColor(x.agent)};font-weight:600;white-space:nowrap">${esc(x.agent)}</td>
    <td>${esc(x.message)}</td>
  </tr>`).join('')||'<tr><td colspan="5" class="empty">No messages</td></tr>';
  return `<div class="card"><h2 style="margin-top:0">Communications</h2>
    <div class="filters">
      <select id="fComAgent"><option value="">All agents</option>${agents.map(a=>`<option ${f.comAgent===a?'selected':''}>${esc(a)}</option>`).join('')}</select>
      <select id="fComTask"><option value="">All tasks</option>${tasks.map(t=>`<option ${f.comTask===t?'selected':''}>${esc(t)}</option>`).join('')}</select>
      ${projects.length?`<select id="fComProject"><option value="">All projects</option>${projects.map(p=>`<option ${f.comProject===p?'selected':''}>${esc(p)}</option>`).join('')}</select>`:''}
      <input id="fComSearch" type="text" placeholder="Search messages&hellip;" value="${esc(f.comSearch)}" style="width:180px">
    </div>
    <div class="scroll"><table><thead><tr>
      ${sortTh('Timestamp','com','timestamp')}
      ${sortTh('Project','com','projectName')}
      ${sortTh('Task','com','taskId')}
      ${sortTh('Agent','com','agent')}
      ${sortTh('Message','com','message')}
    </tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function bindComms(){
  const a=document.getElementById('fComAgent'),t=document.getElementById('fComTask'),p=document.getElementById('fComProject'),s=document.getElementById('fComSearch');
  if(a)a.onchange=e=>{f.comAgent=e.target.value;render()};
  if(t)t.onchange=e=>{f.comTask=e.target.value;render()};
  if(p)p.onchange=e=>{f.comProject=e.target.value;render()};
  if(s)s.oninput=e=>{f.comSearch=e.target.value;render()};
}

function vWorklog(){
  let w=state.worklog||[];
  const agents=[...new Set(w.map(x=>x.agent))];
  const tasks=[...new Set(w.flatMap(x=>x.workingTaskId||[]))];
  const projects=[...new Set(w.map(x=>x.projectName||'').filter(Boolean))];
  if(f.wkAgent)w=w.filter(x=>x.agent===f.wkAgent);
  if(f.wkStatus)w=w.filter(x=>x.status===f.wkStatus);
  if(f.wkTask)w=w.filter(x=>(x.workingTaskId||[]).includes(f.wkTask));
  if(f.wkProject)w=w.filter(x=>(x.projectName||'')===f.wkProject);
  w=sortArr(w,f.wkSort,f.wkDir);
  // gantt grouped by agent
  const byAgent={};w.forEach(x=>{(byAgent[x.agent]=byAgent[x.agent]||[]).push(x)});
  const stCol={success:'#4ade80',partial:'#f5c842',blocked:'#fb923c',failed:'#f87171'};
  const all=w.map(x=>+new Date(x.timestamp)).filter(n=>!isNaN(n));
  const t0=all.length?Math.min(...all):0, t1=all.length?Math.max(...all):1;
  const span=Math.max(1,t1-t0);
  let gantt=Object.keys(byAgent).map(ag=>{
    const bars=byAgent[ag].map(x=>{
      const start=+new Date(x.timestamp);const left=isNaN(start)?0:(start-t0)/span*88;
      const wd=Math.max(4,durMs(x.duration)/span*88);
      return `<div class="gbar" title="${esc(ag)} \u2022 ${esc(x.topic||'')} \u2022 ${esc(x.duration||'')} \u2022 ${esc((x.workingTaskId||[]).join(','))}" style="left:${left}%;width:${wd}%;background:${stCol[x.status]||'#7c6ef0'}">${esc(x.duration||'')}</div>`;
    }).join('');
    return `<div class="grow"><span style="color:${agentColor(ag)}">${esc(ag)}</span><div class="track">${bars}</div></div>`;
  }).join('')||'<div class="empty">No worklog entries</div>';
  const totCtxTok=w.reduce((s,x)=>s+Math.ceil(+(x.contextSize||0)/4),0);
  const totIOTok=w.reduce((s,x)=>s+Math.ceil(+(x.totalInputOutputSize||0)/4),0);
  const rows=w.map(x=>{
    const ctxTok=Math.ceil(+(x.contextSize||0)/4);
    const ioTok=Math.ceil(+(x.totalInputOutputSize||0)/4);
    return `<tr>
      <td style="white-space:nowrap;font-size:12px">${esc(new Date(x.timestamp).toLocaleString())}</td>
      <td style="font-size:11px;color:var(--text3)">${esc(x.projectName||'')}</td>
      <td style="color:${agentColor(x.agent)}">${esc(x.agent)}</td>
      <td>${esc(x.model||'')}</td>
      <td>${esc((x.workingTaskId||[]).join(', '))}</td>
      <td>${esc(x.topic||'')}</td>
      <td style="text-align:right;font-family:monospace">${ctxTok.toLocaleString()}</td>
      <td style="text-align:right;font-family:monospace">${ioTok.toLocaleString()}</td>
      <td>${esc(x.duration||'')}</td>
      <td class="st-${esc(x.status)}">${esc(x.status||'')}</td></tr>`;
  }).join('')||'<tr><td colspan="10" class="empty">No entries</td></tr>';
  const wlTotRow=`<tr style="font-weight:700;background:rgba(255,255,255,0.04)">
    <td colspan="6" style="color:var(--text2)">TOTAL (${w.length} runs)</td>
    <td style="text-align:right;font-family:monospace">${totCtxTok.toLocaleString()}</td>
    <td style="text-align:right;font-family:monospace">${totIOTok.toLocaleString()}</td>
    <td colspan="2"></td>
  </tr>`;
  return `<div class="card"><h2 style="margin-top:0">Worklog Timeline</h2>
    <div class="filters">
      <select id="fWkAgent"><option value="">All agents</option>${agents.map(a=>`<option ${f.wkAgent===a?'selected':''}>${esc(a)}</option>`).join('')}</select>
      <select id="fWkStatus"><option value="">All status</option>${['success','partial','blocked','failed'].map(s=>`<option ${f.wkStatus===s?'selected':''}>${s}</option>`).join('')}</select>
      <select id="fWkTask"><option value="">All working tasks</option>${tasks.map(t=>`<option ${f.wkTask===t?'selected':''}>${esc(t)}</option>`).join('')}</select>
      ${projects.length?`<select id="fWkProject"><option value="">All projects</option>${projects.map(p=>`<option ${f.wkProject===p?'selected':''}>${esc(p)}</option>`).join('')}</select>`:''}
    </div>
    <div class="gantt">${gantt}</div>
    <h2>Runs</h2>
    <div class="scroll"><table><thead><tr>
      ${sortTh('Time','wk','timestamp')}
      ${sortTh('Project','wk','projectName')}
      ${sortTh('Agent','wk','agent')}
      ${sortTh('Model','wk','model')}
      ${sortTh('Working Tasks','wk','workingTaskId')}
      ${sortTh('Topic','wk','topic')}
      ${sortTh('Ctx Tokens','wk','contextSize','text-align:right')}
      ${sortTh('I/O Tokens','wk','totalInputOutputSize','text-align:right')}
      ${sortTh('Duration','wk','duration')}
      ${sortTh('Status','wk','status')}
    </tr></thead><tbody>${rows}${wlTotRow}</tbody></table></div>
  </div>`;
}
function bindWork(){
  const a=document.getElementById('fWkAgent'),s=document.getElementById('fWkStatus'),t=document.getElementById('fWkTask'),p=document.getElementById('fWkProject');
  if(a)a.onchange=e=>{f.wkAgent=e.target.value;render()};
  if(s)s.onchange=e=>{f.wkStatus=e.target.value;render()};
  if(t)t.onchange=e=>{f.wkTask=e.target.value;render()};
  if(p)p.onchange=e=>{f.wkProject=e.target.value;render()};
}

function vDecisions(){
  let d=state.decisions||[];
  const types=[...new Set(d.map(x=>x.type))];
  const projects=[...new Set(d.map(x=>x.projectName||'').filter(Boolean))];
  if(f.decType)d=d.filter(x=>x.type===f.decType);
  if(f.decProject)d=d.filter(x=>(x.projectName||'')===f.decProject);
  if(f.decTask)d=d.filter(x=>(x.taskId||'').toLowerCase().includes(f.decTask.toLowerCase()));
  d=sortArr(d,f.decSort,f.decDir);
  const chips=types.map(t=>`<span class="chip ${f.decType===t?'on':''}" data-t="${esc(t)}">${esc(t)}</span>`).join('');
  const rows=d.map(x=>`<tr>
    <td style="font-family:monospace;font-size:11px;white-space:nowrap">${esc(x.timestamp?new Date(x.timestamp).toLocaleString():'')}</td>
    <td style="font-size:11px;color:var(--text3)">${esc(x.projectName||'')}</td>
    <td><span class="pill">${esc(x.taskId)}</span></td>
    <td style="color:var(--accent2);font-weight:600">${esc(x.type)}</td>
    <td>${esc(x.description)}</td>
  </tr>`).join('')||'<tr><td colspan="5" class="empty">No decisions logged</td></tr>';
  return `<div class="card"><h2 style="margin-top:0">Key Decisions</h2>
    <div class="filters">
      <span class="chip ${!f.decType?'on':''}" data-t="">All</span>${chips}
      ${projects.length?`<select id="fDecProject"><option value="">All projects</option>${projects.map(p=>`<option ${f.decProject===p?'selected':''}>${esc(p)}</option>`).join('')}</select>`:''}
      <input id="fDecTask" type="text" placeholder="Filter task ID&hellip;" value="${esc(f.decTask)}" style="width:130px">
    </div>
    <div class="scroll"><table><thead><tr>
      ${sortTh('Timestamp','dec','timestamp')}
      ${sortTh('Project','dec','projectName')}
      ${sortTh('Task','dec','taskId')}
      ${sortTh('Type','dec','type')}
      ${sortTh('Description','dec','description')}
    </tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function bindDec(){
  document.querySelectorAll('.chip[data-t]').forEach(c=>c.onclick=()=>{f.decType=c.getAttribute('data-t');render()});
  const p=document.getElementById('fDecProject'),t=document.getElementById('fDecTask');
  if(p)p.onchange=e=>{f.decProject=e.target.value;render()};
  if(t)t.oninput=e=>{f.decTask=e.target.value;render()};
}

function vCost(){
  let w=(state.worklog||[]).map(x=>({...x,_cost:estimateCost(x),_credits:estimateCredits(x)}));
  const projects=[...new Set(w.map(x=>x.projectName||'').filter(Boolean))];
  const agents=[...new Set(w.map(x=>x.agent))];
  const models=[...new Set(w.map(x=>x.model||'').filter(Boolean))];
  if(f.costProject)   w=w.filter(x=>(x.projectName||'')===f.costProject);
  if(f.costAgent)     w=w.filter(x=>x.agent===f.costAgent);
  if(f.costModel)     w=w.filter(x=>(x.model||'')===f.costModel);
  if(f.costWorkingTask) w=w.filter(x=>(x.workingTaskId||[]).some(t=>t.toLowerCase().includes(f.costWorkingTask.toLowerCase())));
  if(f.costFrom)      w=w.filter(x=>new Date(x.timestamp)>=new Date(f.costFrom));
  if(f.costTo)        w=w.filter(x=>new Date(x.timestamp)<=new Date(f.costTo+'T23:59:59Z'));
  w=sortArr(w,f.costSort,f.costDir);
  const totCtx=w.reduce((s,x)=>s+Math.ceil(+(x.contextSize||0)/4),0);
  const totIO=w.reduce((s,x)=>s+Math.ceil(+(x.totalInputOutputSize||0)/4),0);
  const totCost=w.reduce((s,x)=>s+x._cost,0);
  const totCredits=w.reduce((s,x)=>s+x._credits,0);
  // cost by agent bar chart
  const byAgent={};
  w.forEach(x=>{
    const ag=x.agent||'Unknown';
    if(!byAgent[ag])byAgent[ag]={ctx:0,io:0,cost:0,runs:0};
    byAgent[ag].ctx+=Math.ceil(+(x.contextSize||0)/4);
    byAgent[ag].io+=Math.ceil(+(x.totalInputOutputSize||0)/4);
    byAgent[ag].cost+=x._cost;
    byAgent[ag].runs++;
  });
  const maxCost=Math.max(1,...Object.values(byAgent).map(v=>v.cost));
  const agentBars=Object.entries(byAgent).map(([ag,v])=>`
    <div class="frow" style="grid-template-columns:170px 1fr 150px">
      <span style="color:${agentColor(ag)};overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(ag)}">${esc(ag)}</span>
      <div class="bar" style="width:${v.cost/maxCost*100}%;opacity:${v.cost>0?1:.25}"></div>
      <span style="text-align:right;font-family:monospace;color:var(--gold)">$${v.cost.toFixed(4)} &middot; ${(v.cost/USD_PER_CREDIT).toFixed(2)}cr</span>
    </div>`).join('')||'<div class="empty">No data</div>';
  // detail table
  const rows=w.map(x=>{
    const ctxTok=Math.ceil(+(x.contextSize||0)/4);
    const ioTok=Math.ceil(+(x.totalInputOutputSize||0)/4);
    return `<tr>
      <td style="white-space:nowrap;font-size:12px">${esc(new Date(x.timestamp).toLocaleString())}</td>
      <td style="font-size:11px;color:var(--text3)">${esc(x.projectName||'&mdash;')}</td>
      <td style="color:${agentColor(x.agent)}">${esc(x.agent)}</td>
      <td>${esc(x.model||'')}</td>
      <td>${esc((x.workingTaskId||[]).join(', '))}</td>
      <td>${esc(x.topic||'')}</td>
      <td style="text-align:right;font-family:monospace">${ctxTok.toLocaleString()}</td>
      <td style="text-align:right;font-family:monospace">${ioTok.toLocaleString()}</td>
      <td style="text-align:right;font-family:monospace;color:var(--gold)">$${x._cost.toFixed(4)}</td>
      <td style="text-align:right;font-family:monospace;color:var(--cyan)">${x._credits.toFixed(2)}</td>
    </tr>`;
  }).join('')||'<tr><td colspan="10" class="empty">No entries match filters</td></tr>';
  const totRow=`<tr style="font-weight:700;background:rgba(255,255,255,0.04)">
    <td colspan="6" style="color:var(--text2)">TOTAL (${w.length} runs)</td>
    <td style="text-align:right;font-family:monospace">${totCtx.toLocaleString()}</td>
    <td style="text-align:right;font-family:monospace">${totIO.toLocaleString()}</td>
    <td style="text-align:right;font-family:monospace;color:var(--gold)">$${totCost.toFixed(4)}</td>
    <td style="text-align:right;font-family:monospace;color:var(--cyan)">${totCredits.toFixed(2)}</td>
  </tr>`;
  return `<div class="card">
    <h2 style="margin-top:0">Cost Estimation</h2>
    <p style="font-size:11px;color:var(--text3);margin-bottom:18px">Estimates use the GitHub Models per-1M-token price list. Formula: context tokens &times; input rate + output tokens &times; output rate. AI Credits = est. USD &divide; $${USD_PER_CREDIT.toFixed(2)} (1 credit = $${USD_PER_CREDIT.toFixed(2)}).</p>
    <div class="grid kpis" style="margin-bottom:20px">
      <div class="card kpi"><div class="v" style="color:var(--accent2)">${w.length}</div><div class="l">Filtered Runs</div></div>
      <div class="card kpi"><div class="v" style="color:var(--cyan);font-size:22px">${totCtx.toLocaleString()}</div><div class="l">Context Tokens</div><div class="s">contextSize &divide; 4</div></div>
      <div class="card kpi"><div class="v" style="color:var(--pink);font-size:22px">${totIO.toLocaleString()}</div><div class="l">I/O Tokens</div><div class="s">totalInputOutputSize &divide; 4</div></div>
      <div class="card kpi"><div class="v" style="color:var(--gold)">$${totCost.toFixed(4)}</div><div class="l">Est. Cost (USD)</div></div>
      <div class="card kpi"><div class="v" style="color:var(--cyan)">${totCredits.toFixed(2)}</div><div class="l">Est. AI Credits</div><div class="s">1 credit = $${USD_PER_CREDIT.toFixed(2)}</div></div>
    </div>
    <div class="filters">
      <select id="fCostProject"><option value="">All projects</option>${projects.map(s=>`<option ${f.costProject===s?'selected':''}>${esc(s)}</option>`).join('')}</select>
      <select id="fCostAgent"><option value="">All agents</option>${agents.map(a=>`<option ${f.costAgent===a?'selected':''}>${esc(a)}</option>`).join('')}</select>
      <select id="fCostModel"><option value="">All models</option>${models.map(m=>`<option ${f.costModel===m?'selected':''}>${esc(m)}</option>`).join('')}</select>
      <input id="fCostWorkingTask" type="text" placeholder="Filter working task ID&hellip;" value="${esc(f.costWorkingTask)}" style="width:160px">
      <input id="fCostFrom" type="date" value="${esc(f.costFrom)}" title="From date">
      <input id="fCostTo"   type="date" value="${esc(f.costTo)}"   title="To date">
    </div>
    <h2>Cost by Agent</h2>
    <div class="funnel" style="margin-bottom:20px">${agentBars}</div>
    <h2>Run Detail</h2>
    <div class="scroll"><table>
      <thead><tr>
        ${sortTh('Time','cost','timestamp')}
        ${sortTh('Project','cost','projectName')}
        ${sortTh('Agent','cost','agent')}
        ${sortTh('Model','cost','model')}
        ${sortTh('Working Tasks','cost','workingTaskId')}
        ${sortTh('Topic','cost','topic')}
        ${sortTh('Ctx Tokens','cost','contextSize','text-align:right')}
        ${sortTh('I/O Tokens','cost','totalInputOutputSize','text-align:right')}
        ${sortTh('Est. Cost','cost','_cost','text-align:right')}
        ${sortTh('Est. AI Credits','cost','_credits','text-align:right')}
      </tr></thead>
      <tbody>${rows}${totRow}</tbody>
    </table></div>
  </div>`;
}
function bindCost(){
  const map={fCostProject:'costProject',fCostAgent:'costAgent',fCostModel:'costModel',fCostFrom:'costFrom',fCostTo:'costTo'};
  Object.entries(map).forEach(([id,key])=>{
    const el=document.getElementById(id);
    if(el)el.onchange=e=>{f[key]=e.target.value;render()};
  });
  const ti=document.getElementById('fCostWorkingTask');
  if(ti)ti.oninput=e=>{f.costWorkingTask=e.target.value;render()};
}

function vPipeline(){
  let t=state.tasks||[];
  const projects=[...new Set(t.map(x=>x.projectName||'').filter(Boolean))];
  const statuses=[...new Set(t.map(x=>x.status))];
  if(f.pipeProject)t=t.filter(x=>(x.projectName||'')===f.pipeProject);
  if(f.pipeStatus)t=t.filter(x=>x.status===f.pipeStatus);
  if(f.pipeSearch)t=t.filter(x=>(x.key||'').toLowerCase().includes(f.pipeSearch.toLowerCase())||(x.title||'').toLowerCase().includes(f.pipeSearch.toLowerCase()));
  t=sortArr(t,f.pipeSort,f.pipeDir);
  const stColor={RETRIEVED:'var(--text2)',TODO:'var(--gold)',IMPLEMENTING:'var(--cyan)',IMPLEMENTED:'var(--accent2)',TESTING:'var(--orange)',TESTED:'var(--green)',PUSHING:'var(--cyan)',PUSHED:'var(--accent2)',REVIEWING:'var(--orange)',REVIEWED:'var(--green)'};
  const rows=t.map(x=>`<tr>
    <td><span class="pill">${esc(x.key)}</span></td>
    <td style="font-weight:600">${esc(x.title)}</td>
    <td style="font-size:11px;color:var(--text3)">${esc(x.projectName||'')}</td>
    <td><span style="color:${stColor[x.status]||'var(--text2)'};font-weight:700">${esc(x.status)}</span></td>
    <td style="font-family:monospace;font-size:11px">${esc(x.timestamp?new Date(x.timestamp).toLocaleString():'')}</td>
    <td>${x.link?`<a href="${esc(x.link)}" target="_blank" rel="noopener noreferrer">&#8599; Jira</a>`:''}</td>
  </tr>`).join('')||'<tr><td colspan="6" class="empty">No tasks retrieved</td></tr>';
  const statusChips=statuses.map(s=>`<span class="chip ${f.pipeStatus===s?'on':''}" onclick="sortPipeStatus('${esc(s)}')">${esc(s)}</span>`).join('');
  return `<div class="card"><h2 style="margin-top:0">Pipeline &mdash; Jira Tasks</h2>
    <div class="filters">
      <span class="chip ${!f.pipeStatus?'on':''}" onclick="sortPipeStatus('')">All</span>${statusChips}
      ${projects.length?`<select id="fPipeProject"><option value="">All projects</option>${projects.map(p=>`<option ${f.pipeProject===p?'selected':''}>${esc(p)}</option>`).join('')}</select>`:''}
      <input id="fPipeSearch" type="text" placeholder="Search task&hellip;" value="${esc(f.pipeSearch)}" style="width:160px">
    </div>
    <div class="scroll"><table><thead><tr>
      ${sortTh('Task ID','pipe','key')}
      ${sortTh('Title','pipe','title')}
      ${sortTh('Project','pipe','projectName')}
      ${sortTh('Status','pipe','status')}
      ${sortTh('Retrieved','pipe','timestamp')}
      <th>Link</th>
    </tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function bindPipeline(){
  const p=document.getElementById('fPipeProject'),s=document.getElementById('fPipeSearch');
  if(p)p.onchange=e=>{f.pipeProject=e.target.value;render()};
  if(s)s.oninput=e=>{f.pipeSearch=e.target.value;render()};
}

function vPricing(){
  const groups=[
    {name:'OpenAI',cols:['Model','Input','Cached input','Output'],rows:[
      ['GPT-5 mini','$0.25','$0.025','$2.00'],
      ['GPT-5.2','$1.75','$0.175','$14.00'],
      ['GPT-5.2-Codex','$1.75','$0.175','$14.00'],
      ['GPT-5.3-Codex','$1.75','$0.175','$14.00'],
      ['GPT-5.4','$2.50','$0.25','$15.00'],
      ['GPT-5.4 mini','$0.75','$0.075','$4.50'],
      ['GPT-5.4 nano','$0.20','$0.02','$1.25'],
      ['GPT-5.5','$5.00','$0.50','$30.00'],
    ]},
    {name:'Anthropic',cols:['Model','Input','Cached input','Cache write','Output'],rows:[
      ['Claude Haiku 4.5','$1.00','$0.10','$1.25','$5.00'],
      ['Claude Sonnet 4','$3.00','$0.30','$3.75','$15.00'],
      ['Claude Sonnet 4.5','$3.00','$0.30','$3.75','$15.00'],
      ['Claude Sonnet 4.6','$3.00','$0.30','$3.75','$15.00'],
      ['Claude Opus 4.5','$5.00','$0.50','$6.25','$25.00'],
      ['Claude Opus 4.6','$5.00','$0.50','$6.25','$25.00'],
      ['Claude Opus 4.7','$5.00','$0.50','$6.25','$25.00'],
      ['Claude Opus 4.8','$5.00','$0.50','$6.25','$25.00'],
    ]},
    {name:'Google',cols:['Model','Input','Cached input','Output'],rows:[
      ['Gemini 2.5 Pro','$1.25','$0.125','$10.00'],
      ['Gemini 3 Flash','$0.50','$0.05','$3.00'],
      ['Gemini 3.1 Pro','$2.00','$0.20','$12.00'],
      ['Gemini 3.5 Flash','$1.50','$0.15','$9.00'],
    ]},
    {name:'Fine-tuned (GitHub)',cols:['Model','Input','Cached input','Output'],rows:[
      ['Raptor mini','$0.25','$0.025','$2.00'],
    ]},
    {name:'Microsoft',cols:['Model','Input','Cached input','Output'],rows:[
      ['MAI-Code-1-Flash','$0.75','$0.075','$4.50'],
    ]},
  ];
  const sections=groups.map(g=>`
    <h2>${esc(g.name)}</h2>
    <div class="scroll" style="max-height:none;margin-bottom:8px"><table>
      <thead><tr>${g.cols.map((c,i)=>`<th style="${i>0?'text-align:right':''}">${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${g.rows.map(r=>`<tr>${r.map((cell,i)=>`<td style="${i>0?'text-align:right;font-family:monospace':'font-weight:600;color:var(--accent2)'}">${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`).join('');
  return `<div class="card">
    <h2 style="margin-top:0">Models &amp; Pricing</h2>
    <p style="font-size:12px;color:var(--text2);margin-bottom:10px">All prices are per 1 million tokens (USD). 1 AI credit = $${USD_PER_CREDIT.toFixed(2)}.</p>
    <p style="font-size:12px;margin-bottom:16px">Official reference: <a href="https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing" target="_blank" rel="noopener noreferrer">GitHub Copilot &mdash; Models and pricing &#8599;</a></p>
    ${sections}
  </div>`;
}

poll();
setInterval(poll,1500);
</script>
</body>
</html>
'@

# Substitute agent portrait images into the dashboard HTML
$script:Html = $script:Html.Replace('__ZEUS__',       $script:ImgZeus)
$script:Html = $script:Html.Replace('__HERMES__',     $script:ImgHermes)
$script:Html = $script:Html.Replace('__PROMETHEUS__', $script:ImgPrometheus)
$script:Html = $script:Html.Replace('__THEMIS__',     $script:ImgThemis)
$script:Html = $script:Html.Replace('__CHARON__',     $script:ImgCharon)
$script:Html = $script:Html.Replace('__METIS__',      $script:ImgMetis)
$script:Html = $script:Html.Replace('__HARMONIA__',   $script:ImgHarmonia)

# ─────────────────────────────────────────────────────────────
# HTTP server
# ─────────────────────────────────────────────────────────────
$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Host "ERROR: Could not start listener on $prefix" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "Try a different port:  .\Pantheon-Lens.ps1 -Port 8088" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "  +==============================================+" -ForegroundColor Magenta
Write-Host "  |            PANTHEON-LENS  is live             |" -ForegroundColor Magenta
Write-Host "  +==============================================+" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Dashboard : $prefix" -ForegroundColor Cyan
Write-Host "  Workspace : $WorkspacePath" -ForegroundColor Gray
Write-Host "  Watching  : .github\pantheon-temp\  +  .github\pantheon-worklog\" -ForegroundColor Gray
if (-not (Test-Path -LiteralPath $script:TempDir)) {
    Write-Host "  NOTE      : pantheon-temp not found yet - it will appear once agents run." -ForegroundColor Yellow
}
Write-Host ""
Write-Host "  Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

if (-not $NoBrowser) { Start-Process $prefix | Out-Null }

$utf8 = [System.Text.Encoding]::UTF8
try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $req = $ctx.Request
        $res = $ctx.Response
        try {
            $path = $req.Url.AbsolutePath
            if ($path -eq '/api/state') {
                $state = Get-PantheonState
                $json = $state | ConvertTo-Json -Depth 8 -Compress
                $buf = $utf8.GetBytes($json)
                $res.ContentType = 'application/json; charset=utf-8'
                $res.Headers.Add('Cache-Control', 'no-store')
            }
            elseif ($path -eq '/' -or $path -eq '/index.html') {
                $buf = $utf8.GetBytes($script:Html)
                $res.ContentType = 'text/html; charset=utf-8'
            }
            else {
                $res.StatusCode = 404
                $buf = $utf8.GetBytes('Not Found')
                $res.ContentType = 'text/plain; charset=utf-8'
            }
            $res.ContentLength64 = $buf.Length
            $res.OutputStream.Write($buf, 0, $buf.Length)
        } catch {
            try { $res.StatusCode = 500 } catch {}
        } finally {
            try { $res.OutputStream.Close() } catch {}
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
