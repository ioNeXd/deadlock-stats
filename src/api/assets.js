import{apiGet}from"./client.js";
export function getHeroes(options={}){return apiGet("/v1/assets/heroes",options)}
export function getRanks(options={}){return apiGet("/v1/assets/ranks",options)}
export function getItems(options={}){return apiGet("/v1/assets/items",options)}
