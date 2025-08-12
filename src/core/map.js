import { state } from './state.js';

// src/core/map.js — PATCHPOINT: MAP_TILE_URL
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export function createMap(){
  const map = L.map('map', { zoomControl:true, worldCopyJump:true, minZoom:2, maxZoom:18 });
  L.tileLayer(TILE_URL, { attribution:'Tiles © Esri', noWrap:false, maxZoom:19 }).addTo(map);
  state.map = map;

  const svgLayer = L.svg({clickable:false}).addTo(map);
  state.svg = svgLayer._container.querySelector('svg');

  state.layers = {
    units: L.layerGroup().addTo(map),
    buildings: L.layerGroup().addTo(map),
    walls: L.layerGroup().addTo(map),
  };

  // geo helpers
  state.isLand = (latlng)=>{
    const {lat,lng} = latlng; for(const b of state.LAND_BOXES){ if(lat>=b[0] && lat<=b[2] && lng>=b[1] && lng<=b[3]) return true } return false;
  };
  state.distance = (a,b)=> map.distance(a,b);
  state.latlngTowards = (from,to,dist)=>{
    const total=state.distance(from,to); if(total===0 || dist>=total) return to;
    const r=dist/total; return L.latLng(from.lat+(to.lat-from.lat)*r, from.lng+(to.lng-from.lng)*r);
  };
  state.offset = (latlng, m)=> state.offsetDir(latlng, m, Math.random()*Math.PI*2);
  state.offsetDir = (latlng, meters, angleRad)=>{
    const d=meters, ang=angleRad;
    const lat = latlng.lat + (d*Math.cos(ang))/111320;
    const lng = latlng.lng + (d*Math.sin(ang))/(40075000*Math.cos(latlng.lat*Math.PI/180)/360);
    return L.latLng(lat,lng);
  };
  state.canUnitGoTo = (u,dest)=>{
    const medium = u.unitType? state.STATS[u.unitType].medium : 'land';
    const land = state.isLand(dest);
    if(medium==='land') return land;
    if(medium==='water') return !land;
    return true; // air
  };
}
