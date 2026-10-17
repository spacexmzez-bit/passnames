import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import App from './game-ui.js';
import RoomHub from './room-ui.js';
import './style.css';
const h=React.createElement;
function saved(key,fallback){try{return localStorage.getItem(key)||fallback;}catch{return fallback;}}
function Button({children,...props}){return h('button',{type:'button',className:'button',...props},children);}
function Site(){
 const [local,setLocal]=useState(false);
 if(!local)return h(RoomHub,{onLocal:()=>setLocal(true)});
 const label=saved('passnames-language','ar')==='en'?'Back to rooms':'العودة للغرف';
 return h(React.Fragment,null,h('div',{className:'surface-switch'},h(Button,{onClick:()=>setLocal(false)},label)),h(App));
}
createRoot(document.getElementById('root')).render(h(Site));
