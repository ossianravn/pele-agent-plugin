# Pele diagram types

Pele renders standard Mermaid plus several newer types. Each example below renders with the bundled pele version;
adapt the content, keep the structure. More examples: <https://pele.run/examples>.

## Swimlane: who does which step

Each `subgraph` is a lane. Edges cross lanes.

```mermaid
swimlane-beta LR
  subgraph Customer
    request[Request refund]
    receive[Receive money]
  end
  subgraph Support
    triage[Triage request]
    decide{Eligible?}
  end
  subgraph Finance
    pay[Issue refund]
  end
  request --> triage --> decide
  decide -->|Yes| pay --> receive
  decide -->|No| request
```

## Architecture: services and infrastructure

Icons: `cloud`, `database`, `disk`, `internet`, `server`. Edges name the side of each node: `L`, `R`, `T`, `B`.

```mermaid
architecture-beta
  group api(cloud)[API]
  service gateway(internet)[Gateway] in api
  service app(server)[App server] in api
  service db(database)[Postgres] in api
  gateway:R --> L:app
  app:R --> L:db
```

## Agentflow: agents, tools and data

`flow` blocks group steps. Shapes include `input`, `task`, `tool`, `action` and `refdoc`.

```mermaid
agentflow-beta LR
  flow research["Researcher"]
    question["Question"]@{ shape: input }
    search["web_search"]@{ shape: tool }
    question --> search
  end
  flow writer["Writer"]
    draft["Draft answer"]@{ shape: task }
    guide["Style guide"]@{ shape: refdoc }
    draft -.- guide
  end
  search --> draft
```

## Tree view: files and folders

Indent children; end folders with `/`. `##` adds a comment.

```mermaid
treeView-beta
  src/
    server.ts ## MCP tools
    board.ts ## live page
  web/
    index.html
  package.json
```

## Ishikawa: causes of a problem

The first line is the problem; each unindented group below is a category of causes.

```mermaid
ishikawa-beta
  Slow checkout
  Frontend
    Large bundle
    Blocking fonts
  Backend
    N+1 queries
  Infrastructure
    Cold starts
```

## Block: a fixed grid of parts

```mermaid
block
  columns 3
  client["Client"] gateway["Gateway"] service["Service"]
  space:2 db[("Database")]
```

## Cynefin, Wardley, Venn and radar

```mermaid
cynefin-beta
  title Where our open questions sit
  complex
    "Pricing model"
  complicated
    "Data migration"
  clear
    "Release checklist"
  chaotic
    "Production outage"
```

```mermaid
wardley-beta
  title Build or buy
  anchor User [0.95, 0.70]
  component App [0.75, 0.40]
  component Auth [0.50, 0.80]
  component Hosting [0.20, 0.90]
  User -> App
  App -> Auth
  App -> Hosting
```

```mermaid
venn-beta
  title Who owns what
  set A["Frontend"]
  set B["Backend"]
  union A,B["API contract"]
```

```mermaid
radar-beta
  title Options compared
  axis cost["Cost"], speed["Speed"], risk["Low risk"]
  curve a["Option A"]{4, 2, 3}
  curve b["Option B"]{2, 4, 4}
  max 5
```

## Event modeling

```mermaid
eventmodeling
timeframe 01 ui CartUI
timeframe 02 command AddItem
timeframe 03 event ItemAdded
timeframe 04 processor InventoryCheck
```
