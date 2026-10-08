import {createApp}from'./app.js';import{env,assertEnv}from'./config/env.js';assertEnv();createApp().listen(env.PORT,'0.0.0.0',()=>console.log(`CivicPulse API listening on ${env.PORT}`));
