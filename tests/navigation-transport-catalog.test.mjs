import assert from "node:assert/strict";
import test from "node:test";
import { defaultTransportationCatalog,validateTransportationCatalog,
  selectedTransportationProfile,listTransportationPresets,findTransportationPreset,
  setTransportationPreset,deleteCustomTransportationPreset,resetTransportationPreset,
  addOptionalTirelessExamples,transportationCostPreview,estimateTransportationTrip,TRANSPORT_CATALOG_SETTING,
  OPTIONAL_TIRELESS_EXAMPLES } from "../scripts/navigation-transport-catalog.js";

const settings=(values={})=>({get(_module,key){return values[key];}});
const sample={id:"custom-skiff",name:"Skiff",kind:"vehicle",surface:"water",
  speedMph:2.5,costCp:20,costBasis:"day",purchaseGp:100,note:"Quiet."};

test("D&D 2024 catalog includes walking, official mounts and listed vessels",()=>{
  const list=listTransportationPresets(settings(),"dnd5e");
  const ids=new Set(list.map(p=>p.id));
  for(const id of ["walking","mounted","riding-horse","warhorse","mule",
    "carriage","coach-hire","airship","galley","keelboat","longship",
    "rowboat","sailing","warship","ship-passage"])assert.ok(ids.has(id),id);
  assert.equal(findTransportationPreset("mounted",settings(),"dnd5e").speedMph,3);
  assert.equal(findTransportationPreset("sailing",settings(),"dnd5e").speedMph,2);
  assert.equal(findTransportationPreset("airship",settings(),"dnd5e").speedMph,8);
  assert.equal(findTransportationPreset("rowboat",settings(),"dnd5e").speedMph,1.5);
  assert.equal(findTransportationPreset("coach-hire",settings(),"dnd5e").costCp,3);
  assert.equal(findTransportationPreset("ship-passage",settings(),"dnd5e").costCp,10);
  assert.equal(findTransportationPreset("walking",settings(),"dnd5e").speedMph,null);
  assert.equal(list.filter(p=>p.builtIn).length,list.length);
});

test("profile switch projects distinct references and independent World overrides",()=>{
  const base=defaultTransportationCatalog();
  const old=findTransportationPreset("sailing",settings(),"dnd5e");
  const edited=setTransportationPreset(base,"dnd5e2024",
    {...old,speedMph:3.2,costCp:5,costBasis:"day"});
  const values={[TRANSPORT_CATALOG_SETTING]:edited,guidedTravelRulesProfile:"dnd5e2024"};
  assert.equal(findTransportationPreset("sailing",settings(values),"dnd5e").speedMph,3.2);
  values.guidedTravelRulesProfile="dnd5e2014";
  assert.equal(selectedTransportationProfile(settings(values),"dnd5e"),"dnd5e2014");
  assert.equal(findTransportationPreset("sailing",settings(values),"dnd5e").speedMph,2);
  values.guidedTravelRulesProfile="custom";
  assert.equal(findTransportationPreset("sailing",settings(values),"dnd5e").speedMph,2);
  values.guidedTravelRulesProfile="system";
  assert.equal(selectedTransportationProfile(settings(values),"pf2e"),"neutral");
  assert.equal(selectedTransportationProfile(settings(values),"dnd5e"),"dnd5e2024");
  assert.equal(findTransportationPreset("sailing",settings(values),"pf2e").speedMph,2);
  assert.equal(findTransportationPreset("sailing",settings(values),"dnd5e").speedMph,3.2);
  assert.equal(old.speedMph,2,"reference remains immutable");
});

test("legacy World mounted/sailing speeds are retained, without migration writes",()=>{
  const values={
    guidedMountedSpeed:12.5,guidedSailingSpeed:7.25,
    [TRANSPORT_CATALOG_SETTING]:defaultTransportationCatalog()
  };
  assert.equal(findTransportationPreset("mounted",settings(values),"dnd5e").speedMph,12.5);
  assert.equal(findTransportationPreset("sailing",settings(values),"dnd5e").speedMph,7.25);
  const item=findTransportationPreset("mounted",settings(values),"dnd5e");
  values[TRANSPORT_CATALOG_SETTING]=setTransportationPreset(values[TRANSPORT_CATALOG_SETTING],
    "dnd5e2024",{...item,speedMph:4,costCp:0,costBasis:"none"});
  assert.equal(findTransportationPreset("mounted",settings(values),"dnd5e").speedMph,4);
  assert.throws(()=>findTransportationPreset("mounted",settings({guidedMountedSpeed:0}),"dnd5e"),/speed/i);
});

test("custom presets use stable IDs, validated boundaries, and never change existing data",()=>{
  const first=defaultTransportationCatalog();
  const next=setTransportationPreset(first,"dnd5e2024",sample);
  assert.equal(first.customs.length,0);
  assert.deepEqual(validateTransportationCatalog(next).customs[0],sample);
  assert.equal(findTransportationPreset("custom-skiff",
    settings({[TRANSPORT_CATALOG_SETTING]:next}),"dnd5e").speedMph,2.5);
  const replaced=setTransportationPreset(next,"dnd5e2024",
    {...sample,speedMph:3.75,name:"Fast skiff"});
  assert.equal(replaced.customs.length,1);
  assert.equal(replaced.customs[0].name,"Fast skiff");
  assert.equal(deleteCustomTransportationPreset(replaced,sample.id).customs.length,0);
  assert.throws(()=>deleteCustomTransportationPreset(first,"walking"),/cannot be deleted/i);
  assert.throws(()=>setTransportationPreset(first,"dnd5e2024",
    {...sample,id:"walking",speedMph:3}),/invalid/i);
  assert.throws(()=>setTransportationPreset(first,"dnd5e2024",
    {...sample,costCp:-1}),/invalid/i);
  assert.throws(()=>setTransportationPreset(first,"dnd5e2024",
    {...sample,speedMph:Infinity}),/invalid/i);
});

test("catalog validation refuses malformed, duplicate and future-version records",()=>{
  assert.throws(()=>validateTransportationCatalog({version:4,overrides:{},customs:[]}),/version/i);
  const cat=defaultTransportationCatalog();
  cat.customs=[sample,{...sample}];
  assert.throws(()=>validateTransportationCatalog(cat),/duplicate/i);
  const bad=defaultTransportationCatalog();bad.overrides.dnd5e2024={
    sailing:{speedMph:0,costCp:0,costBasis:"none",purchaseGp:null}};
  assert.throws(()=>validateTransportationCatalog(bad),/invalid/i);
  const wrong=defaultTransportationCatalog();wrong.customs=[
    {...sample,name:"<img src=x onerror=alert(1)>",id:"../../bad"}];
  assert.throws(()=>validateTransportationCatalog(wrong),/invalid/i);
});

test("reset and optional workbook examples are explicit and idempotent",()=>{
  const base=defaultTransportationCatalog();
  const item=findTransportationPreset("mounted",settings(),"dnd5e");
  const change=setTransportationPreset(base,"dnd5e2024",
    {...item,speedMph:4.5,costCp:20,costBasis:"day"});
  assert.ok(change.overrides.dnd5e2024.mounted);
  const reset=resetTransportationPreset(change,"dnd5e2024","mounted");
  assert.equal(reset.overrides.dnd5e2024.mounted,undefined);
  assert.equal(change.overrides.dnd5e2024.mounted.speedMph,4.5);
  const imported=addOptionalTirelessExamples(base);
  assert.equal(imported.customs.length,OPTIONAL_TIRELESS_EXAMPLES.length);
  assert.equal(addOptionalTirelessExamples(imported).customs.length,imported.customs.length);
  assert.equal(imported.customs.find(p=>p.id==="custom-giant-eagle").speedMph,8);
  assert.match(imported.customs[0].note,/not the 2024/i);
});

test("cost projections are informational and use declared CP basis",()=>{
  assert.equal(transportationCostPreview({costBasis:"mile",costCp:3},10,5),30);
  assert.equal(transportationCostPreview({costBasis:"day",costCp:5},10,25),10);
  assert.equal(transportationCostPreview({costBasis:"none",costCp:5},10,25),0);
});


test("the workbook import includes previously missing magical and campaign methods",()=>{
  const catalog=addOptionalTirelessExamples(defaultTransportationCatalog());
  const ids=new Set(catalog.customs.map(p=>p.id));
  for(const id of ["custom-pegasus","custom-griffon","custom-phantom-steed",
    "custom-carpet-of-flying-3x5","custom-broom-of-flying","custom-wind-walk",
    "custom-lyrandar-airship","custom-lyrandar-galleon",
    "custom-orien-lightning-rail","custom-battle-balloon",
    "custom-mechanical-beholder"])
    assert.ok(ids.has(id),id);
  assert.ok(catalog.customs.length>=40);
  assert.ok(OPTIONAL_TIRELESS_EXAMPLES.every(p=>p.note.includes("Not the 2024")));
});

test("2014 rowboats/warships retain workbook-era speed without changing 2024 values",()=>{
  const values={guidedTravelRulesProfile:"dnd5e2014"};
  assert.equal(findTransportationPreset("rowboat",settings(values),"dnd5e").speedMph,2);
  assert.equal(findTransportationPreset("warship",settings(values),"dnd5e").speedMph,3);
  values.guidedTravelRulesProfile="dnd5e2024";
  assert.equal(findTransportationPreset("rowboat",settings(values),"dnd5e").speedMph,1.5);
  assert.equal(findTransportationPreset("warship",settings(values),"dnd5e").speedMph,2.5);
});

test("already imported optional creature labels are clarified without modifying stored catalogs",()=>{
  const catalog=defaultTransportationCatalog();
  catalog.customs.push({id:"custom-giant-eagle",name:"Giant Eagle (optional tireless)",
    kind:"mount",surface:"air",speedMph:8,costCp:0,costBasis:"none",
    purchaseGp:null,note:"Optional workbook example: tireless movement-speed conversion, not the 2024 sustained mount rule."});
  const values={guidedTransportationCatalog:catalog,guidedTravelRulesProfile:"dnd5e2024"};
  const displayed=findTransportationPreset("custom-giant-eagle",settings(values),"dnd5e");
  assert.equal(displayed.name,"Giant Eagle");
  assert.match(displayed.note,/Optional workbook planning/);
  assert.match(catalog.customs[0].name,/optional tireless/,"saved World data is unchanged");
});

test("optional seat capacity and cost-per-passenger settings preserve legacy catalogs",()=>{
  const legacy=defaultTransportationCatalog();
  const legacySample={...sample};
  const saved=setTransportationPreset(legacy,"dnd5e2024",legacySample);
  assert.deepEqual(saved.customs[0],legacySample,"v1 records remain readable without forced fields");
  const updated=setTransportationPreset(saved,"dnd5e2024",
    {...sample,capacity:4,costApplies:"passenger"});
  const projected=findTransportationPreset("custom-skiff",
    settings({[TRANSPORT_CATALOG_SETTING]:updated}),"dnd5e");
  assert.equal(projected.capacity,4);
  assert.equal(projected.costApplies,"passenger");
  const horse=findTransportationPreset("camel",settings(),"dnd5e");
  assert.equal(horse.capacity,1);
  assert.equal(horse.costApplies,"unit");
  const hire=findTransportationPreset("coach-hire",settings(),"dnd5e");
  assert.equal(hire.costApplies,"passenger");
  const invalid={...sample,capacity:0};
  assert.throws(()=>setTransportationPreset(legacy,"dnd5e2024",invalid),/Invalid/);
});

test("v1 transportation catalogs migrate only in memory; crew reference values are projected",()=>{
  const legacy={version:1,overrides:{dnd5e2024:{
    warship:{speedMph:2.7,costCp:0,costBasis:"none",purchaseGp:25000}
  }},customs:[sample]};
  const source=JSON.stringify(legacy);
  const projected=validateTransportationCatalog(legacy);
  assert.equal(projected.version,3);
  assert.equal(JSON.stringify(legacy),source,"no mutation of World flags");
  const values={[TRANSPORT_CATALOG_SETTING]:legacy};
  assert.equal(findTransportationPreset("warship",settings(values),"dnd5e").speedMph,2.7);
  assert.equal(findTransportationPreset("warship",settings(values),"dnd5e").crewCount,60);
  assert.equal(findTransportationPreset("warship",settings(values),"dnd5e").capacity,60);
  assert.equal(findTransportationPreset("galley",settings(values),"dnd5e").crewCount,80);
  assert.equal(findTransportationPreset("galley",settings(values),"dnd5e").capacity,null);
  assert.equal(findTransportationPreset("airship",settings(values),"dnd5e").capacity,20);
  assert.equal(findTransportationPreset("carriage",settings(values),"dnd5e").capacity,4);
  assert.equal(findTransportationPreset("custom-skiff",settings(values),"dnd5e").crewCount,0);
  assert.equal(findTransportationPreset("warship",settings(values),"dnd5e").includeCrewWages,false);
});

test("World crew and wage options are stored independently for each rules profile",()=>{
  const original=findTransportationPreset("warship",settings(),"dnd5e");
  const revised=setTransportationPreset(defaultTransportationCatalog(),"dnd5e2024",
    {...original,crewCount:18,crewWageCpPerDay:350,includeCrewWages:true});
  assert.equal(revised.version,3);
  const current=findTransportationPreset("warship",
    settings({[TRANSPORT_CATALOG_SETTING]:revised}),"dnd5e");
  assert.equal(current.crewCount,18);
  assert.equal(current.crewWageCpPerDay,350);
  assert.equal(current.includeCrewWages,true);
  const other=findTransportationPreset("warship",
    settings({[TRANSPORT_CATALOG_SETTING]:revised,guidedTravelRulesProfile:"dnd5e2014"}),"dnd5e");
  assert.equal(other.crewCount,60);
  assert.equal(other.includeCrewWages,false);
  for(const invalid of [{crewCount:-1},{crewCount:1.5},
    {crewWageCpPerDay:-1},{crewWageCpPerDay:Infinity},{includeCrewWages:"yes"}]){
    assert.throws(()=>setTransportationPreset(revised,"dnd5e2024",
      {...original,...invalid}),/Invalid/);
  }
});

test("100-mile and one-day examples use one unit, 8-hour days and optional crew wages",()=>{
  const horse=findTransportationPreset("riding-horse",settings(),"dnd5e");
  const hundred=estimateTransportationTrip(horse,{distanceMi:100});
  assert.equal(hundred.travelDays,5);
  assert.equal(hundred.movingHours,100/3);
  assert.equal(hundred.recurringCp,25);
  assert.equal(hundred.crewWagesCp,0);
  assert.equal(hundred.totalCp,25);
  const oneDay=estimateTransportationTrip(horse,{distanceMi:24});
  assert.equal(oneDay.travelDays,1);
  assert.equal(oneDay.recurringCp,5);
  const ship=findTransportationPreset("warship",settings(),"dnd5e");
  assert.equal(estimateTransportationTrip(ship,{distanceMi:100}).crewWagesCp,0);
  const hired=estimateTransportationTrip({...ship,includeCrewWages:true},
    {distanceMi:100,units:1});
  assert.equal(hired.travelDays,5);
  assert.equal(hired.crewWagesCp,60*200*5);
  assert.equal(hired.totalCp,60000);
  const passage=findTransportationPreset("ship-passage",settings(),"dnd5e");
  assert.equal(estimateTransportationTrip(passage,{distanceMi:100,passengers:3}).recurringCp,3000);
  const disabled=estimateTransportationTrip({...ship,includeCrewWages:false,crewCount:60},
    {distanceMi:100});
  assert.equal(disabled.totalCp,0);
  assert.throws(()=>estimateTransportationTrip({...horse,speedMph:0},{distanceMi:100}),/Invalid/);
});

test("beta.4b service profiles migrate v2 World data without writes or false availability",()=>{
  const legacy={version:2,overrides:{},customs:[sample]};
  const saved=JSON.stringify(legacy);
  assert.equal(validateTransportationCatalog(legacy).version,3);
  assert.equal(JSON.stringify(legacy),saved);
  const values={[TRANSPORT_CATALOG_SETTING]:legacy};
  const coach=findTransportationPreset("coach-hire",settings(values),"dnd5e");
  assert.equal(coach.hireEnabled,true);
  assert.equal(coach.hireCostCp,3);
  assert.equal(coach.hireBasis,"mile");
  assert.equal(coach.hireApplies,"passenger");
  const wagon=findTransportationPreset("wagon",settings(values),"dnd5e");
  assert.equal(wagon.hireEnabled,true);
  assert.equal(wagon.hireCostCp,400);
  assert.equal(wagon.hireCrewIncluded,true);
  assert.equal(wagon.overtimeEnabled,false);
  assert.equal(wagon.continuousEnabled,false);
  const ownedShip=findTransportationPreset("warship",settings(values),"dnd5e");
  assert.equal(ownedShip.continuousEnabled,false,
    "continuous sailing requires an explicit GM setting");
  assert.equal(findTransportationPreset("custom-skiff",settings(values),"dnd5e").hireEnabled,false,
    "custom imports do not gain hired services implicitly");
});

test("service rates and capabilities persist per profile and validate eligibility",()=>{
  const ship=findTransportationPreset("warship",settings(),"dnd5e");
  const changed=setTransportationPreset(defaultTransportationCatalog(),"dnd5e2024",{
    ...ship,hireEnabled:true,hireCostCp:2500,hireBasis:"trip",
    hireApplies:"unit",hireCrewIncluded:false,
    overtimeEnabled:true,overtimeMultiplier:1.7,overtimeExtraHours:6,
    continuousEnabled:true});
  const recorded=findTransportationPreset("warship",
    settings({[TRANSPORT_CATALOG_SETTING]:changed}),"dnd5e");
  assert.equal(recorded.hireCostCp,2500);
  assert.equal(recorded.overtimeExtraHours,6);
  assert.equal(recorded.continuousEnabled,true);
  const other=findTransportationPreset("warship",
    settings({[TRANSPORT_CATALOG_SETTING]:changed,guidedTravelRulesProfile:"dnd5e2014"}),"dnd5e");
  assert.equal(other.continuousEnabled,false,"rules profile edits remain independent");
  const horse=findTransportationPreset("riding-horse",settings(),"dnd5e");
  assert.throws(()=>setTransportationPreset(changed,"dnd5e2024",
    {...horse,continuousEnabled:true}),/Invalid/);
  assert.throws(()=>setTransportationPreset(changed,"dnd5e2024",
    {...horse,hireEnabled:true}),/Invalid/);
  assert.throws(()=>setTransportationPreset(changed,"dnd5e2024",
    {...ship,overtimeMultiplier:0.5}),/Invalid/);
  assert.throws(()=>setTransportationPreset(changed,"dnd5e2024",
    {...ship,overtimeExtraHours:9}),/Invalid/);
  assert.throws(()=>setTransportationPreset(changed,"dnd5e2024",
    {...ship,hireBasis:"week"}),/Invalid/);
});

test("beta.4c.3 uses published transport references and backward-compatible crew wage frequencies",()=>{
  const baseline=listTransportationPresets(settings(),"dnd5e");
  const item=id=>baseline.find(p=>p.id===id);
  assert.equal(item("cart").purchaseGp,15);
  assert.equal(item("riding-horse").purchaseGp,75);
  assert.equal(item("sailing").purchaseGp,10000);
  assert.equal(item("sailing").crewCount,20);
  assert.equal(item("sailing").crewWageBasis,"day");
  assert.equal(item("warhorse").hireEnabled,false,"one-seat mounts are not hired by default");
  assert.match(item("cart").note,/draft animal/i);
  const modified=setTransportationPreset(defaultTransportationCatalog(),"dnd5e2024",
    {...item("sailing"),crewWageBasis:"mile",crewWageCpPerDay:300,
      includeCrewWages:true});
  const reread=findTransportationPreset("sailing",settings({
    [TRANSPORT_CATALOG_SETTING]:modified}),"dnd5e");
  assert.equal(reread.crewWageBasis,"mile");
  const cost=estimateTransportationTrip(reread,{distanceMi:10,dayHours:8,units:1});
  assert.equal(cost.crewWagesCp,20*300*10,"distance wages multiply crew and mileage");
  assert.throws(()=>setTransportationPreset(modified,"dnd5e2024",
    {...reread,crewWageBasis:"hour"}),/Invalid/i);
});
