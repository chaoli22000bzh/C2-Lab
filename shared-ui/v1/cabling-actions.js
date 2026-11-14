/* Actions graphiques de câblage. Source de vérité : registre R2D3. */
const rejected=(code,message)=>({success:false,code,message});
export function connectorsForPoints(registry,fromPortId,toPortId){
 const points=registry.listCablePoints(),a=points.find(p=>p.portId===fromPortId),b=points.find(p=>p.portId===toPortId);
 if(!a||!b)return null;
 const plug=socket=>socket?.endsWith("-female")?socket.slice(0,-7)+"-male":
  socket?.endsWith("-socket")?socket.slice(0,-7)+"-plug":null;
 const connectors=[plug(a.socket),plug(b.socket)];
 return connectors.every(Boolean)&&connectors.every(c=>registry.cableConnectors().includes(c))?connectors:null;
}
export function connectNewCable(registry,fromPortId,toPortId){
 if(fromPortId===toPortId)return rejected("same_port","Choisir deux ports différents.");
 const points=registry.listCablePoints(),a=points.find(p=>p.portId===fromPortId),b=points.find(p=>p.portId===toPortId);
 if(!a||!b)return rejected("not_found","Port introuvable.");
 if(a.occupied||b.occupied)return rejected("port_occupied","Un de ces ports possède déjà un câble.");
 const connectors=connectorsForPoints(registry,fromPortId,toPortId);
 if(!connectors)return rejected("unsupported_port","Ces ports ne prennent pas en charge un câble compatible.");
 const created=registry.createCable({connectors});
 if(!created.success)return created;
 const id=created.cable.id;
 const first=registry.connectCableEnd(id,0,fromPortId);
 if(!first.success){registry.deleteCable(id);return first;}
 const second=registry.connectCableEnd(id,1,toPortId);
 if(!second.success){registry.deleteCable(id);return second;}
 return {success:true,code:"connected",message:"Câble "+id+" raccordé.",cableId:id};
}
export function attachExistingCable(registry,cableId,endIndex,portId){
 if(endIndex!==0&&endIndex!==1)return rejected("invalid_end","Extrémité inconnue.");
 return registry.connectCableEnd(cableId,endIndex,portId);
}
export function detachExistingCable(registry,cableId,endIndex){
 if(endIndex!==0&&endIndex!==1)return rejected("invalid_end","Extrémité inconnue.");
 return registry.disconnectCableEnd(cableId,endIndex);
}
