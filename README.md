# Forby HTML5 Open Tibia Client and Server

# Installation

The server runs on NodeJS and is lightweight. It requires only two NPM modules that can be installed using `npm install`. The client directory needs to be hosted and accessible over HTTP e.g., `cd client; python3 -m http.server`. It does not have to be Python but can also be done using Node, NGINX or Apache, or even GitHub pages. 

# Running

    git clone https://github.com/Inconcessus/Tibia74-JS-Engine.git`
    cd Tibia74-JS-Engine
    npm install
    node engine.js
    node login.js
    python client-server.py

Visit the resources hosted at `http://127.0.0.1:8000/` and login using the default credentials.

# Server Engine

This is the main engine for the server. It runs over the WebSocket protocol and required a valid login token from the login server to upgrade HTTP connections to the WebSocket protocol.

# Login Server

The login server is responsible for creating and managing player accounts. If the player succesfully logs in with a valid account number and password an SHA256-HMAC token is returned including a pointer to the data to load. This token is automatically passed to the gameserver by the game client and has its signature verified. The verification is done by a shared secret in the configuration file.
