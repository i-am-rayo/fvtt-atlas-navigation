import test from "node:test";
import assert from "node:assert/strict";
import {suggestTerritoryCheckpointLinks,effectiveCheckpointLabelMode,
  territoryDisplayName,geographicLinkNameMatch,checkpointTerritoryChoices,
  territoryCheckpointChoices,territoryLinkOptionGroups}
  from "../scripts/territory-checkpoint-presentation.js";

const territory=(id,name,kind)=>({id,name,linked:true,invalid:false,
  geography:{kind}});

test("exact name and matching city/town/village/settlement type produce review-only suggestions",()=>{
  const regions=[territory("dirwest","Dirwest","city"),
    territory("millstone","Millstone","village"),
    territory("hearth","Hearth's Heart","settlement"),
    territory("sea","Dirwest","area")];
  const checkpoints=[{id:"c1",name:" dirwest "},{id:"c2",name:"Millstone"},
    {id:"c3",name:"Dirwest North"},{id:"c4",name:"HEARTH'S  HEART"}];
  const types={c1:"city",c2:"village",c3:"city",c4:"settlement"};
  assert.deepEqual(suggestTerritoryCheckpointLinks(regions,checkpoints,id=>types[id]),
    [{regionId:"dirwest",checkpointId:"c1"},
      {regionId:"millstone",checkpointId:"c2"},
      {regionId:"hearth",checkpointId:"c4"}]);
  assert.deepEqual(suggestTerritoryCheckpointLinks([...regions,
    territory("duplicate","Dirwest","city")],checkpoints,id=>types[id]),
    [{regionId:"millstone",checkpointId:"c2"},
      {regionId:"hearth",checkpointId:"c4"}],
  "duplicate names must not produce ambiguous auto-suggestions");
  assert.deepEqual(suggestTerritoryCheckpointLinks(regions,checkpoints,
    id=>id==="c1"?"town":types[id]),[{regionId:"millstone",checkpointId:"c2"},
      {regionId:"hearth",checkpointId:"c4"}]);
  assert.deepEqual(suggestTerritoryCheckpointLinks(regions,checkpoints,
    id=>id==="c4"?"town":types[id]),[{regionId:"dirwest",checkpointId:"c1"},
      {regionId:"millstone",checkpointId:"c2"}],
    "a Settlement cannot be suggested for a Checkpoint typed as Town");
});

test("visible geographic name temporarily moves an Always checkpoint label to Hover",()=>{
  assert.equal(effectiveCheckpointLabelMode("always",true),"hover");
  assert.equal(effectiveCheckpointLabelMode("always",false),"always");
  assert.equal(effectiveCheckpointLabelMode("off",true),"off");
  assert.equal(effectiveCheckpointLabelMode("hover",true),"hover");
  assert.equal(territoryDisplayName("Dirwest Area",{name:"Dirwest"}),"Dirwest");
  assert.equal(territoryDisplayName("Dirwest Area",null),"Dirwest Area");
});

test("close name suggestions require a complete leading place name, with Unicode preserved",()=>{
  assert.equal(geographicLinkNameMatch("Ježibaba","Ježibaba - Abandoned Town"),"prefix");
  assert.equal(geographicLinkNameMatch("JEŽIBABA  — ABANDONED TOWN","Ježibaba"),"prefix");
  assert.equal(geographicLinkNameMatch("Hearth's Heart"," hearth's  heart "),"exact");
  assert.equal(geographicLinkNameMatch("Port","Portage"),null);
  assert.equal(geographicLinkNameMatch("Dirwest","Old Dirwest"),null);
  assert.equal(geographicLinkNameMatch("A","A Town"),null,
    "one-letter prefixes do not count as meaningful close matches");
  assert.equal(geographicLinkNameMatch("", "Dirwest"),null);
});

test("Checkpoint picker lists same-kind available, claimed and current Territories",()=>{
  const territories=[territory("jezi","Ježibaba","town"),
    territory("exact","Ježibaba - Abandoned Town","town"),
    territory("other","Other Town","town"),
    territory("claimed","Already Claimed","town"),
    territory("city","Ježibaba - Abandoned Town","city")];
  const links=[{regionId:"claimed",link:{checkpointId:"other-cp"}}];
  const checkpoint={id:"jezi-cp",name:"Ježibaba - Abandoned Town"};
  const selection=checkpointTerritoryChoices({checkpoint,kind:"town",territories,links});
  assert.equal(selection.suggestedId,"exact");
  assert.deepEqual(selection.candidates.map(c=>c.id),
    ["exact","jezi","other","claimed"]);
  assert.deepEqual(selection.candidates.map(c=>c.match),["exact","prefix",null,null]);
  assert.equal(selection.candidates.at(-1).disabledReason,"claimed");
  const groups=territoryLinkOptionGroups(selection.candidates,{noneLabel:"No linked Territory",
    ownerNameFor:id=>id==="other-cp"?"Other Checkpoint":id});
  assert.deepEqual(groups.map(group=>group.label),[null,
    "Suggested names · review before linking","Other compatible locations",
    "Unavailable · shown for reference"]);
  assert.match(groups.at(-1).options[0][1],/Other Checkpoint/);
  assert.deepEqual(groups.at(-1).options[0][2],{disabled:true});
  const linked=checkpointTerritoryChoices({checkpoint,kind:"town",territories,
    links:[...links,{regionId:"other",link:{checkpointId:"jezi-cp"}}]});
  assert.equal(linked.currentId,"other");
  assert.equal(linked.candidates.find(c=>c.id==="other").disabled,false);
  assert.equal(linked.candidates.find(c=>c.id==="exact").disabledReason,"unlink-first");
  assert.equal(linked.suggestedId,null,"an active association prevents suggested switching");
});

test("ambiguous prefixes stay manual; old mismatched links remain visible for unlinking",()=>{
  const checkpoint={id:"jezi",name:"Ježibaba - Abandoned Town"};
  const territories=[territory("first","Ježibaba","town"),
    territory("second","Ježibaba - Abandoned","town"),
    territory("legacy","Old Geography","city")];
  const unlinked=checkpointTerritoryChoices({checkpoint,kind:"town",territories});
  assert.equal(unlinked.suggestedId,null,"two close matches must not preselect a candidate");
  assert.deepEqual(unlinked.candidates.map(c=>c.match),["prefix","prefix"]);
  const old=checkpointTerritoryChoices({checkpoint,kind:"town",territories,
    links:[{regionId:"legacy",link:{checkpointId:"jezi"}}]});
  assert.equal(old.candidates[0].id,"legacy");
  assert.equal(old.candidates[0].disabled,false);
  assert.equal(old.candidates[0].kind,"city");
});

test("Territory picker mirrors Checkpoint rules and disables claimed or wrong-kind choices",()=>{
  const eyrie=territory("eyrie","The Eyrie","settlement");
  const checkpoints=[{id:"prefix",name:"The Eyrie - Raven Keep"},
    {id:"other",name:"Ravenhold"},{id:"claimed",name:"The Eyrie"},
    {id:"wrong",name:"The Eyrie"}];
  const types={prefix:"settlement",other:"settlement",claimed:"settlement",wrong:"city"};
  const selection=territoryCheckpointChoices({territory:eyrie,checkpoints,
    categoryFor:id=>types[id],links:[{regionId:"other-territory",link:{checkpointId:"claimed"}}]});
  assert.equal(selection.suggestedId,"prefix");
  assert.deepEqual(selection.candidates.map(c=>c.id),["prefix","other","claimed"]);
  assert.equal(selection.candidates.at(-1).disabled,true);
  assert.equal(selection.candidates.at(-1).match,"exact");
  const current=territoryCheckpointChoices({territory:eyrie,checkpoints,
    categoryFor:id=>types[id],links:[{regionId:"eyrie",link:{checkpointId:"other"}}]});
  assert.equal(current.currentId,"other");
  assert.equal(current.candidates.find(c=>c.id==="prefix").disabledReason,"unlink-first");
});
