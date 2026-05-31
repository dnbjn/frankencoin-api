"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// exports/index.ts
var exports_exports = {};
__export(exports_exports, {
  BidsQueryType: () => BidsQueryType,
  ChallengesQueryStatus: () => ChallengesQueryStatus
});
module.exports = __toCommonJS(exports_exports);

// src/modules/challenges/challenges.types.ts
var ChallengesQueryStatus = /* @__PURE__ */ ((ChallengesQueryStatus2) => {
  ChallengesQueryStatus2["Active"] = "Active";
  ChallengesQueryStatus2["Success"] = "Success";
  return ChallengesQueryStatus2;
})(ChallengesQueryStatus || {});
var BidsQueryType = /* @__PURE__ */ ((BidsQueryType2) => {
  BidsQueryType2["Averted"] = "Averted";
  BidsQueryType2["Succeeded"] = "Succeeded";
  return BidsQueryType2;
})(BidsQueryType || {});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BidsQueryType,
  ChallengesQueryStatus
});
