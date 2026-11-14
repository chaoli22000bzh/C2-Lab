/* Vue de câblage pédagogique : projection pure puis affichage en lecture seule. */
export function buildCablingViewModel(registry, selectedPlaceId = "") {
  const places = registry.listPlaces();
  const assets = registry.listAssets();
  const panels = registry.listPanels();
  const outlets = registry.listWallOutlets();
  const cables = registry.listCables();
  const points = registry.listCablePoints();
  const byPort = new Map(points.map(p => [p.portId, p]));
  const cablesAtPort = new Map();
  for (const cable of cables) for (const end of cable.ends)
    if (end?.portId) cablesAtPort.set(end.portId, cable.id);
  const port = (p, label) => ({
    id: p.id, label, cableId: cablesAtPort.get(p.id) ?? null
  });
  const devices = [
    ...panels.map(p => ({
      id: p.id, name: p.name, kind: "Panneau de brassage",
      placeId: p.placeId,
      ports: p.ports.flatMap(slot => [
        port(slot.front, slot.label + " avant"),
        port(slot.back, slot.label + " arrière")
      ])
    })),
    ...assets.map(a => ({
      id: a.id, name: a.name, kind: "Équipement",
      placeId: a.placeId,
      ports: a.ports.filter(p => byPort.has(p.id)).map(p => port(p, p.name))
    })),
    ...outlets.map(o => ({
      id: o.id, name: o.name, kind: "Prise murale (" + o.location + ")",
      placeId: null, unlocated: true,
      ports: o.ports.flatMap(slot => [
        port(slot.front, slot.label + " avant"),
        port(slot.back, slot.label + " arrière")
      ])
    }))
  ];
  // Les prises historiques n'ont pas de placeId canonique : ne pas déduire
  // leur emplacement d'une simple chaîne et les afficher hors filtre.
  const visible = selectedPlaceId
    ? devices.filter(d => d.placeId === selectedPlaceId)
    : devices;
  const visiblePorts = new Set(visible.flatMap(d => d.ports.map(p => p.id)));
  const connections = cables.filter(c => !selectedPlaceId ||
    c.ends.some(end => end && visiblePorts.has(end.portId))
  ).map(c => {
    const ends = c.ends.map((end, i) => {
      if (!end?.portId) return {label: "Extrémité " + (i ? "B" : "A") + " libre", free: true};
      const p = byPort.get(end.portId);
      return {label: p ? p.assetName + " / " + p.portName : "Port introuvable",
        portId: end.portId, free: false, outside: !!selectedPlaceId && !visiblePorts.has(end.portId)};
    });
    return {id: c.id, ends, complete: ends.every(e => !e.free)};
  });
  return {places: places.map(p => ({id:p.id, name:p.name})), selectedPlaceId,
    devices: visible, connections,
    unlocatedOutlets: outlets.length > 0 && !!selectedPlaceId};
}

export function renderCablingVisual(root, model, actions = {}) {
  root.replaceChildren();
  const el = (tag, className, value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  };
  const makeButton=(label,callback,className="subtle")=>{
    const button=el("button",className,label);button.type="button";button.onclick=callback;return button;
  };
  const selectedPort=actions.selectedPortId;
  const selectedCable=actions.selectedCableId;
  const wiring=!!actions.onPortClick;
  const group=el("div","cv-devices");
  for(const device of model.devices){
    const card=el("article","cv-device");
    card.append(el("div","cv-kind",device.kind),el("strong","cv-name",device.name));
    const row=el("div","cv-ports");
    if(!device.ports.length)row.append(el("span","cv-muted","Aucun port physique"));
    for(const p of device.ports){
      const highlighted=!!p.cableId&&p.cableId===selectedCable;
      const cls="cv-port "+(p.cableId?"cv-occupied":"cv-free")+
        (p.id===selectedPort?" cv-selected":"")+(highlighted?" cv-highlight":"");
      const chip=el(wiring?"button":"span",cls,p.label);
      chip.title=p.cableId?"Raccordé à "+p.cableId:"Port libre";
      if(wiring){
        chip.type="button";
        chip.setAttribute("aria-pressed",String(p.id===selectedPort));
        chip.onclick=()=>actions.onPortClick(p.id);
        chip.draggable=true;
        chip.ondragstart=event=>{
          event.dataTransfer.setData("text/plain",p.id);
          event.dataTransfer.effectAllowed="move";
        };
        chip.ondragover=event=>{event.preventDefault();event.dataTransfer.dropEffect="move";};
        chip.ondrop=event=>{
          event.preventDefault();
          const source=event.dataTransfer.getData("text/plain");
          if(source&&actions.onPortDrop)actions.onPortDrop(source,p.id);
        };
      }
      row.append(chip);
    }
    card.append(row);group.append(card);
  }
  if(!model.devices.length)group.append(el("p","cv-muted","Aucun équipement ni panneau dans cette vue."));
  root.append(group);
  root.append(el("h3","","Câbles"));
  const connections=el("div","cv-connections");
  for(const cable of model.connections){
    const active=cable.id===selectedCable;
    const line=el("div","cv-connection"+(active?" cv-connection-selected":""));
    const heading=el("div","cv-cable-heading");
    if(actions.onCableSelect)heading.append(makeButton(cable.id,()=>actions.onCableSelect(cable.id),"cv-cable-choice"));
    else heading.append(el("strong","cv-cable-id",cable.id));
    if(active&&actions.onDisconnect){
      for(let i=0;i<2;i++){
        const end=cable.ends[i];
        if(!end.free)heading.append(makeButton("Débrancher "+(i?"B":"A"),()=>actions.onDisconnect(cable.id,i),"cv-disconnect"));
        else if(actions.onAttach)heading.append(makeButton("Raccorder "+(i?"B":"A"),()=>actions.onAttach(cable.id,i),"cv-attach"));
      }
      if(actions.onDelete)heading.append(makeButton("Supprimer",()=>actions.onDelete(cable.id),"cv-disconnect"));
    }
    line.append(heading);
    const path=el("div","cv-path");
    for(let i=0;i<2;i++){
      const end=cable.ends[i];
      path.append(el("span","cv-end "+(end.free?"cv-muted":"")+
        (end.outside?" cv-outside":""),end.label));
      if(i===0)path.append(el("span","cv-wire "+(cable.complete?"cv-wire-complete":"cv-wire-incomplete")));
    }
    line.append(path);connections.append(line);
  }
  if(!model.connections.length)connections.append(el("p","cv-muted","Aucun câble à afficher."));
  root.append(connections);
  if(model.unlocatedOutlets)root.append(el("p","cv-muted",
    "Les prises murales sans lieu structuré sont visibles dans « Tous les lieux »."));
}
