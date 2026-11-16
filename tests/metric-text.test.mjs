import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source=readFileSync(new URL("../src/components/zisto/Site.tsx",import.meta.url),"utf8");
const file=ts.createSourceFile("Site.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const percentFormatter=new Intl.NumberFormat("el-GR",{maximumFractionDigits:1});
const numberFormatter=new Intl.NumberFormat("el-GR");
const totals={menu_conversion_rate:129.4,review_conversion_rate:47.2,unique_visitors_month:1234,page_views_today:5678};
let checked=0;
function visit(node){
  if(ts.isStringLiteralLike(node)||ts.isTemplateExpression(node)){
    assert.doesNotMatch(node.getText(file),/<(?:CountUp|MetricValue)\b/,"Animation JSX must never be embedded in a string");
  }
  if(ts.isPropertyAssignment(node)&&["value","note"].includes(node.name.getText(file))){
    const text=node.initializer.getText(file);
    if(text.startsWith("`")&&/Formatter\.format\(analytics\.totals\.(menu_conversion_rate|review_conversion_rate|unique_visitors_month|page_views_today)/.test(text)){
      const output=vm.runInNewContext(text,{analytics:{totals},percentFormatter,numberFormatter});
      assert.equal(typeof output,"string");
      assert.doesNotMatch(output,/[<>$]/);
      if(text.includes("menu_conversion_rate"))assert.ok(output.startsWith("129,4%"));
      else if(text.includes("review_conversion_rate"))assert.ok(output.startsWith("47,2%"));
      else if(text.includes("unique_visitors_month"))assert.ok(output.startsWith(numberFormatter.format(totals.unique_visitors_month)));
      else if(text.includes("page_views_today"))assert.ok(output.startsWith(numberFormatter.format(totals.page_views_today)));
      checked++;
    }
  }
  ts.forEachChild(node,visit);
}
visit(file);
assert.ok(checked>=6,"Exercise both contextual conversions, menu/review cards and both overview notes");
console.log("Metric text regression checks passed: all six values format as Greek numbers, without JSX text.");
