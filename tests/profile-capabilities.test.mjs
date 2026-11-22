import test from "node:test";
import assert from "node:assert/strict";
import {createAssetRegistry,restoreAssetRegistry} from "../r2d3-v1/asset-profiles.js";

test("Profil switch : capacités réseau et configuration de l'actif",()=>{
 const e=createAssetRegistry(),p=e.createProfile("Switch pédagogique").profile;
 assert.equal(e.addPortGroup(p.id,{type:"ethernet-rj45",prefix:"LAN",start:1,count:4}).success,true);
 assert.equal(e.setProfileNetworkCapability(p.id,"ethernet-switching",true).success,true);
 assert.equal(e.setProfileNetworkCapability(p.id,"vlan",true).success,true);
 assert.equal(e.setProfilePoe(p.id,true).success,true);
 const a=e.createAsset(p.id,{name:"SW01"}).asset;
 assert.deepEqual(a.networkCapabilities,["ethernet-switching","vlan"]);
 assert.equal(a.ports.length,4);
 assert.equal(a.poe,true);
 assert.equal(a.vlanConfig.assetId,a.id);
 assert.deepEqual(restoreAssetRegistry(e.exportState()).getAsset(a.id).vlanConfig,a.vlanConfig);
});

test("Profil routeur : DHCP et interfaces séparées",()=>{
 const e=createAssetRegistry(),p=e.createProfile("Routeur pédagogique").profile;
 assert.equal(e.addPortGroup(p.id,{type:"ethernet-rj45",prefix:"GE",start:1,count:3}).success,true);
 assert.equal(e.setProfileNetworkCapability(p.id,"ipv4-router",true).success,true);
 assert.equal(e.setProfileNetworkCapability(p.id,"dhcp-server",true).success,true);
 const a=e.createAsset(p.id,{name:"RTR01"}).asset;
 assert.equal(Object.keys(a.routerConfig.interfaces).length,3);
 assert.equal(a.dhcpServerConfig.enabled,false);
 assert.equal(a.networkCapabilities.includes("ipv4-router"),true);
 assert.equal(e.setProfileNetworkCapability(p.id,"ethernet-switching",true).success,false);
});

test("Profil Wi-Fi : ports requis et configuration radio initiale",()=>{
 const e=createAssetRegistry(),p=e.createProfile("Borne pédagogique").profile;
 assert.equal(e.setProfileNetworkCapability(p.id,"wifi-ap",true).success,false);
 assert.equal(e.addPortGroup(p.id,{type:"ethernet-rj45",prefix:"ETH",start:1,count:1}).success,true);
 assert.equal(e.addPortGroup(p.id,{type:"wifi",prefix:"RADIO",start:1,count:1}).success,true);
 assert.equal(e.setProfileNetworkCapability(p.id,"wifi-ap",true).success,true);
 const a=e.createAsset(p.id,{name:"AP01"}).asset;
 assert.equal(a.wifiConfig.enabled,true);
 assert.equal(a.wifiConfig.radios["6"].enabled,false);
 assert.equal(a.wifiConfig.ssids[0].name,"R2D3-WIFI");
 assert.deepEqual(restoreAssetRegistry(e.exportState()).getAsset(a.id).wifiConfig,a.wifiConfig);
});

test("Modification du profil : aucun changement rétroactif des capacités de l'actif",()=>{
 const e=createAssetRegistry(),p=e.createProfile("Profil évolutif").profile;
 e.addPortGroup(p.id,{type:"ethernet-rj45",prefix:"LAN",start:1,count:2});
 const a=e.createAsset(p.id,{name:"A"}).asset;
 assert.equal(e.setProfileNetworkCapability(p.id,"ethernet-switching",true).success,true);
 assert.deepEqual(e.getAsset(a.id).networkCapabilities,[]);
 assert.equal(e.createAsset(p.id,{name:"B"}).asset.networkCapabilities.includes("ethernet-switching"),true);
});
