# adaptTo() Live Server

[![Build](https://github.com/adaptto-live/adaptto-live-server/workflows/Build/badge.svg?branch=develop)](https://github.com/adaptto-live/adaptto-live-server/actions?query=workflow%3ABuild+branch%3Adevelop)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=adaptto-live_adaptto-live-server&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=adaptto-live_adaptto-live-server)

adaptTo() Live server application (Node JS app with socket.io and MongoDB).

Technology Stack:
* NodeJS server application
* Uses Websockets (via socket.io) to communicate with client application
* Uses Mongoose to access MongoDB database

Dependencies:
* Node 18 or higher
* Requires MongoDB server


## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```
