import { FieldRegistry } from "./registry.js";
import { shortText } from "./short-text.js";
import { longText } from "./long-text.js";
import { number } from "./number.js";
import { email } from "./email.js";
import { url } from "./url.js";
import { tel } from "./tel.js";
import { password } from "./password.js";
import { dropdown } from "./dropdown.js";
import { radio } from "./radio.js";
import { checkbox } from "./checkbox.js";
import { checkboxGroup } from "./checkbox-group.js";
import { checklist } from "./checklist.js";
import { date } from "./date.js";
import { time } from "./time.js";
import { datetime } from "./datetime.js";
import { month } from "./month.js";
import { week } from "./week.js";
import { range } from "./range.js";
import { file } from "./file.js";
import { datalist } from "./datalist.js";
import { heading } from "./heading.js";
import { instructions } from "./instructions.js";
import { statement } from "./statement.js";
import { signature } from "./signature.js";
import { image } from "./image.js";

export function registerAllFields() {
  FieldRegistry.register("short-text", shortText);
  FieldRegistry.register("long-text", longText);
  FieldRegistry.register("number", number);
  FieldRegistry.register("email", email);
  FieldRegistry.register("url", url);
  FieldRegistry.register("tel", tel);
  FieldRegistry.register("password", password);
  FieldRegistry.register("dropdown", dropdown);
  FieldRegistry.register("radio", radio);
  FieldRegistry.register("checkbox", checkbox);
  FieldRegistry.register("checkbox-group", checkboxGroup);
  FieldRegistry.register("checklist", checklist);
  FieldRegistry.register("date", date);
  FieldRegistry.register("time", time);
  FieldRegistry.register("datetime", datetime);
  FieldRegistry.register("month", month);
  FieldRegistry.register("week", week);
  FieldRegistry.register("range", range);
  FieldRegistry.register("file", file);
  FieldRegistry.register("datalist", datalist);
  FieldRegistry.register("heading", heading);
  FieldRegistry.register("instructions", instructions);
  FieldRegistry.register("statement", statement);
  FieldRegistry.register("signature", signature);
  FieldRegistry.register("image", image);
}

export const DESIGNER_FIELD_TYPES = [
  { type: "short-text", name: "Short text" },
  { type: "long-text", name: "Long text" },
  { type: "number", name: "Number" },
  { type: "email", name: "Email" },
  { type: "url", name: "URL" },
  { type: "tel", name: "Telephone" },
  { type: "password", name: "Password" },
  { type: "dropdown", name: "Dropdown (select one)" },
  { type: "radio", name: "Radio (select one)" },
  { type: "checkbox", name: "Checkbox (yes/no)" },
  { type: "checkbox-group", name: "Checkboxes (select multiple)" },
  { type: "checklist", name: "Checklist (tick off items, with progress)" },
  { type: "date", name: "Date" },
  { type: "time", name: "Time" },
  { type: "datetime", name: "Date + time" },
  { type: "month", name: "Month" },
  { type: "week", name: "Week" },
  { type: "range", name: "Slider" },
  { type: "file", name: "File upload" },
  { type: "datalist", name: "Text with suggestions" },
  { type: "heading", name: "Heading (display only)" },
  { type: "instructions", name: "Instructions (display only)" },
  { type: "statement", name: "Statement (display only)" },
  { type: "signature", name: "Signature" },
  { type: "image", name: "Image (display only)" },
];

export const OPTIONS_FIELD_TYPES = new Set(["dropdown", "radio", "checkbox-group", "datalist", "checklist"]);
export const DISPLAY_ONLY_FIELD_TYPES = new Set(["heading", "instructions", "statement", "image"]);
export const IMAGE_FIELD_TYPES = new Set(["image"]);
