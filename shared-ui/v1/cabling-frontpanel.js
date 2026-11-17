/*
 * R2D3 - façade RJ45 de brassage, sans état métier ni duplication de câblage.
 * Les prises et les câbles proviennent du registre d'actifs.
 */
import {buildCablingViewModel} from "./cabling-visual.js";
import {connectNewCable,detachExistingCable,attachExistingCable} from "./cabling-actions.js";

const elt=(tag,cls,text)=>{
  const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;
};
const caption=(a,b)=>a+" / "+b;
const defaultOptions={columns:12,face:"front",switchPairs:false};
export function arrangePorts(device,config={},face="front"){
  const opts={...defaultOptions,...config};
  let ports=device.ports;
  if(device.kind==="Panneau de brassage"||device.kind.startsWith("Prise murale"))ports=ports.filter(p=>p.label.endsWith(face==="back"?" arrière":" avant"));
  const indexes=new Map(ports.map(p=>[p.label.replace(/ (avant|arrière)$/,""),p]));
  if(Array.isArray(opts.slots)){
    const ordered=[],used=new Set();
    for(const slot of opts.slots){
      const found=slot===null?null:indexes.get(String(slot));
      ordered.push(found||null);if(found)used.add(found.id);
    }
    for(const p of ports)if(!used.has(p.id))ordered.push(p);
    return ordered;
  }
  return ports;
}
export function buildFrontpanelSnapshot(registry,face="front",layout={}){
  const model=buildCablingViewModel(registry);
  return {devices:model.devices.map(d=>({
    ...d,config:layout[d.id]||layout[d.name]||{},slots:arrangePorts(d,layout[d.id]||layout[d.name]||{},face)
  })),connections:model.connections};
}

/**
 * API: mountCablingFrontpanel({root,registry,layout,face})
 * layout: {"Panneau":{"slots":["A","B",null,"C"],"columns":12},
 *          "SW01":{"switchPairs":true,"columns":12}}
 * L'affichage ne modifie pas le registre en dehors des actions partagées.
 */
export function mountCablingFrontpanel({root,registry,layout={},face="front",devices=null}={}){
  if(!root||!registry?.listCablePoints)throw Error("Façade ou registre R2D3 indisponible.");
  let currentFace=face==="back"?"back":"front",mode="connect",first=null,pathFrom=null,chosenCable=null;
  let highlightedPorts=[],highlightedCables=[],observer=null,disposed=false,pendingAttach=null;
  const el={};
  root.classList.add("cf-root");
  function say(message,ok=true){el.status.textContent=message;el.status.dataset.ok=ok?"1":"0";}
  function setMode(next){
    mode=next;first=null;pathFrom=null;pendingAttach=null;highlightedPorts=[];highlightedCables=[];
    render();say(next==="connect"?"Choisis deux prises libres pour poser un cordon.":"Choisis un départ puis une arrivée pour suivre le chemin.");
  }
  function pointClick(p){
    if(pendingAttach){
      const {cableId,end}=pendingAttach;
      const result=attachExistingCable(registry,cableId,end,p.id);
      if(result.success){pendingAttach=null;chosenCable=cableId;}
      render();say(result.message,result.success);return;
    }
    if(mode==="path"){
      if(!pathFrom){pathFrom=p.id;highlightedPorts=[p.id];render();say("Départ sélectionné. Choisis l'arrivée.");return;}
      const r=registry.explorePhysicalPath(pathFrom,p.id);
      highlightedPorts=r.success&&r.connected?r.path.map(x=>x.portId):[pathFrom,p.id];
      highlightedCables=r.success&&r.connected?r.segments.filter(x=>x.kind==="cable").map(x=>x.id):[];
      pathFrom=null;render();say(r.message,!!(r.success&&r.connected));return;
    }
    if(p.cableId){
      const cable=registry.listCables().find(c=>c.id===p.cableId);
      if(first){say("La prise choisie est déjà occupée.",false);return;}
      chosenCable=cable?.id||null;render();say("Prise occupée : consulte les actions du cordon.");return;
    }
    if(first===p.id){first=null;render();say("Sélection annulée.");return;}
    if(!first){first=p.id;chosenCable=null;render();say("Première prise sélectionnée. Choisis une deuxième prise libre.");return;}
    const from=first;first=null;
    const result=connectNewCable(registry,from,p.id);
    if(result.success)chosenCable=result.cableId;
    render();say(result.message,result.success);
  }
  function cableAction(cableId,end){
    const result=detachExistingCable(registry,cableId,end);
    if(result.success)chosenCable=cableId;
    render();say(result.message,result.success);
  }
  function getPointMap(){return new Map(registry.listCablePoints().map(x=>[x.portId,x]));}
  function drawCords(){
    if(disposed)return;
    const svg=el.svg,board=el.board;if(!svg||!board)return;
    const rect=board.getBoundingClientRect(),w=Math.max(rect.width,1),h=Math.max(rect.height,1);
    svg.setAttribute("viewBox",`0 0 ${w} ${h}`);svg.replaceChildren();
    const anchors=new Map();
    board.querySelectorAll("[data-port-id]").forEach(node=>{
      const r=(node.querySelector(".cf-socket")||node).getBoundingClientRect();
      anchors.set(node.dataset.portId,{x:r.left-rect.left+r.width/2,y:r.top-rect.top+r.height/2});
    });
    for(const cable of registry.listCables()){
      const a=anchors.get(cable.ends[0]?.portId),b=anchors.get(cable.ends[1]?.portId);
      if(!a||!b)continue;
      const lane=Math.max(a.x,b.x)+13;
      const path=document.createElementNS("http://www.w3.org/2000/svg","path");
      path.setAttribute("d",`M${a.x},${a.y} Q${a.x},${a.y+12} ${lane},${a.y+12} L${lane},${b.y-12} Q${lane},${b.y} ${b.x},${b.y}`);
      path.setAttribute("class","cf-cord"+(cable.id===chosenCable||highlightedCables.includes(cable.id)?" cf-cord-active":""));
      path.setAttribute("data-cable-id",cable.id);svg.append(path);
    }
  }
  function render(){
    if(disposed)return;
    root.replaceChildren();
    const toolbar=elt("div","cf-toolbar"),modes=elt("div","cf-modes");
    const connect=elt("button","","Brancher"),follow=elt("button","","Suivre un chemin");
    for(const [btn,key] of [[connect,"connect"],[follow,"path"]]){
      btn.type="button";btn.setAttribute("aria-pressed",String(mode===key));btn.onclick=()=>setMode(key);modes.append(btn);
    }
    const faceLabel=elt("label","cf-face-label","Face du panneau ");
    const facePicker=elt("select","cf-face");
    for(const [value,text] of [["front","Avant"],["back","Arrière"]]){
      const opt=elt("option","",text);opt.value=value;facePicker.append(opt);
    }
    facePicker.value=currentFace;
    facePicker.onchange=()=>{currentFace=facePicker.value;first=null;chosenCable=null;render();say("Face "+(currentFace==="front"?"avant":"arrière")+" affichée.");};
    faceLabel.append(facePicker);toolbar.append(modes,faceLabel);
    el.status=elt("div","cf-status","Choisis deux prises libres pour poser un cordon.");
    el.status.setAttribute("role","status");
    el.board=elt("div","cf-board");
    const snapshot=buildFrontpanelSnapshot(registry,currentFace,layout);
    const visibleDevices=Array.isArray(devices)?snapshot.devices.filter(d=>devices.includes(d.id)||devices.includes(d.name)):snapshot.devices;
    const visiblePortIds=new Set(visibleDevices.flatMap(d=>d.slots.filter(Boolean).map(p=>p.id)));
    const portMap=getPointMap();
    for(const device of visibleDevices){
      const config=device.config;const card=elt("section","cf-device");
      const name=elt("h3","cf-device-name",device.name);
      const meta=elt("span","cf-device-kind",device.kind);
      const head=elt("header","cf-device-head");head.append(name,meta);card.append(head);
      const bank=elt("div","cf-bank");
      const columns=Math.max(1,Math.min(48,Number(config.columns)||12));
      bank.style.setProperty("--cf-columns",String(columns));
      const paired=!!config.switchPairs;
      if(paired)bank.classList.add("cf-bank-paired");
      device.slots.forEach((p,index)=>{
        if(!p){const blank=elt("span","cf-blank");blank.setAttribute("aria-hidden","true");bank.append(blank);return;}
        const node=elt("button","cf-port");
        node.type="button";node.dataset.portId=p.id;
        const name=p.label.replace(/ (avant|arrière)$/,"");
        const number=Number(name.match(/(\d+)$/)?.[1]||index+1);
        const displayName=paired?String(number).padStart(2,"0"):(Array.isArray(config.labels)?config.labels[number-1]||name:name);
        node.setAttribute("aria-label",device.name+", prise "+p.label+(p.cableId?", occupée":", libre"));
        node.title=p.label+(p.cableId?" • raccordée":" • libre");
        node.setAttribute("aria-pressed",String(first===p.id||pathFrom===p.id));
        if(p.cableId)node.classList.add("cf-occupied");
        if(first===p.id||pathFrom===p.id)node.classList.add("cf-selected");
        if(highlightedPorts.includes(p.id))node.classList.add("cf-highlight");
        const numberLabel=elt("span","cf-port-label",displayName);
        const socket=elt("span","cf-socket");
        const recess=elt("span","cf-recess");socket.append(recess);
        node.append(numberLabel,socket);
        node.onclick=()=>pointClick(p);
        if(paired){
          node.style.gridColumn=String(Math.floor(index/2)+1);
          node.style.gridRow=String(index%2+1);
          if(index%2)node.classList.add("cf-upside-down");
        }
        bank.append(node);
      });
      card.append(bank);el.board.append(card);
    }
    el.svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
    el.svg.classList.add("cf-wires");el.svg.setAttribute("aria-hidden","true");
    el.board.append(el.svg);
    const summary=elt("div","cf-connections");
    const title=elt("h3","","Cordons de brassage");summary.append(title);
    for(const cable of registry.listCables().filter(c=>c.ends.some(e=>visiblePortIds.has(e?.portId)))){
      const row=elt("div","cf-connection"+(cable.id===chosenCable?" cf-connection-active":""));
      const text=elt("span","cf-connection-label",cable.id+" : "+cable.ends.map(e=>{
        const p=portMap.get(e?.portId);return p?caption(p.assetName,p.portName):"extrémité libre";
      }).join(" ↔ "));
      row.append(text);
      const select=elt("button","cf-small","Sélectionner");select.type="button";select.onclick=()=>{chosenCable=chosenCable===cable.id?null:cable.id;render();};row.append(select);
      if(chosenCable===cable.id){
        cable.ends.forEach((end,i)=>{
          const button=elt("button","cf-small"+(end?.portId?" cf-disconnect":""),(end?.portId?"Débrancher ":"Raccorder ")+(i?"B":"A"));
          button.type="button";button.onclick=()=>{
            if(end?.portId){cableAction(cable.id,i);return;}
            pendingAttach={cableId:cable.id,end:i};first=null;render();say("Choisis une prise libre pour raccorder l’extrémité "+(i?"B":"A")+".");
          };row.append(button);
        });
      }
      summary.append(row);
    }
    root.append(toolbar,el.status,el.board,summary);
    requestAnimationFrame(drawCords);
  }
  observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(drawCords):null;
  render();
  if(observer)observer.observe(root);
  return {render,refresh:render,setFace(next){currentFace=next==="back"?"back":"front";render();},
    destroy(){disposed=true;observer?.disconnect();root.replaceChildren();root.classList.remove("cf-root");}};
}
