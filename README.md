# Discord Mockup

To initialize the SqLite DB for query macros:

```bash
echo DATABASE_URL=sqlite://dev.db > .env
sqlx database create
```

Add migrations with `sqlx migrate add <name>`

Run migrations with `sqlx migrate run`

## Spec

### Architecture and Tradeoffs

The backend is designed to run on a small AWS box behind Nginx/Cloudflare. 
Currently we're using in-memory SQLite for development, but for production
it should be pretty straightforward to switch to a dockerized TimescaleDB. 
(For this interview, it will just be in-memory SQLite unless Timescale is 
explicitly desired.)

The database isn't indexed and in general there aren't yet many optimizations,
eg sharding, and I don't think I'll implement any.

We serve a static Next.js build: the downside here is that we give up a lot of
SSR features, but I don't think it's worth the time during the interview to switch
to a Node server + Axum server to get Next.js server features.

To deploy, I plan to write a small script that rsyncs the build to an AWS box.
Then systemd will manage the server. Some things in the code are currently
hardcoded but should be made configurable (eg, via env vars). But I don't think 
it's worth doing for the interview.

Timescale + Cloudflare + Nginx + Axum should be totally sufficient to handle
10-50k DAU. Upgrading the AWS box will let us scale for the near term. I'm not
adding Redis or other caching solutions, everything will be raw DB lookups and
for this context it will be fine.

We expose a REST API and SSE streams. It might be worth switching to Websockets,
but the REST parts are already built so I'll stay there unless I have time to kill.
Afaik Discord itself uses WS.

We currently don't have auth. I'm not going to build auth, but OAuth plus some kind
of third-party email auth like Twilio would be the most straightforward I think.

We currently don't have tracing or other telemetry. Self-hosted Grafana would be the 
most straightforward way to get some dashboards, but I'm not going to set it up.

We use Swagger (it's public at `/swagger-ui`) for auto-generated API docs. I think
it's fine to leave it as is.

We can't handle files, images, audio, blobs, etc. I don't think I will prioritize
supporting these. (For a startup I would look into third-party image/video hosting,
embedded players, etc.)

Discord has an Electron app but I don't think it's worth setting up Electron, Tauri,
or similar, or building for platforms other than web in general.

I am going to make AI write all of my CSS. I'll try to test both mobile and
desktop views and ensure it's not horribly broken, but probably no further than that.
I'm using Tailwind for styling (I personally find it the easiest to read and
understand).

### How I See Discord

At its core, I see Discord as a list of messages. Messages are filtered by channel
and server (ie, channels and servers only exist to help organize messages). Some
messages point to other messages (replies) or to threads (a thread is a third grouping
of message within a channel).

(Reactions are a second type of message that always have a message id that they're
associated with.)

Users write and read these messages, and have permissions associated with servers.
Roles are sets of permissions associated with a server and grant things like channel
visibility, ability to edit, and so on. (Bans fit in here too.)

Other features:

- DMs are like a channel associated with users, not servers

- Typing/Online indicators are like an auto-sent message that's not stored in the DB

- Notifications don't need any special architecture, they're calculated frontend
depending solely on the user's settings

- A user report would log a message into a table of reported messages.

### State

The frontend has to be kept in sync with the backend. I plan to build a system with
snapshots (at `/snapshot`) and SSE updates (at `/updates`). On first load, the client
fetches the snapshot and subscribes to updates.

There's going to be some kind of syncing mechanism: if the client falls out of sync,
it will ask for a new snapshot while buffering new updates.

On the frontend there will be optimistic loading of messages.

### Milestone 1

Get a basic version up and running, where users can choose an arbitrary login,
make servers/channels, and write messages. Everything is default-visible. 

### Milestone 2

Add permissions (roles, visibility, admin rights, kicking/banning).

### Milestone 3

Get a state syncing system:
- 

### Other Milestones

Other features: 
- Replies
- Threads
- Reactions
- Typing/Online indicators
- Reports
- DMs
