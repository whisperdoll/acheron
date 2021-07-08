import * as fs from "fs";
import * as vm from "vm";

export default class ScriptEngine
{
    private static scriptMap: Map<number, vm.Script> = new Map();
    private static resultCache: Map<string, any> = new Map();
    private static contextCache: Map<number, vm.Context> = new Map();
    private static contextNameCache: Map<string, vm.Context> = new Map();


}