import BbcodeEditor from "@/app/components/BbcodeEditor";
import { field, labelClass } from "@/app/components/formStyles";
import { ALIGNMENTS } from "@/lib/rules/dnd2024/alignments";
import FieldError from "./FieldError";
import { LIMITS, MAX_XP } from "./constants";

export type InfoValues = {
  alignment: string;
  age: string;
  xp: string;
  appearance: string;
  backstory: string;
  languages: string;
  notes: string;
};

/* Alineamiento, edad, PX, apariencia, historia, idiomas y notas. */
export default function InfoFields({
  values, errors, onChange,
}: {
  values: InfoValues;
  errors: Record<string, string>;
  /** Cambia un campo; `key` es también la clave del error del servidor que deja de aplicar. */
  onChange: (patch: Partial<InfoValues>, ...errorKeys: string[]) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="alignment" className={labelClass}>Alineamiento</label>
        <select id="alignment" className={field} value={values.alignment} onChange={(e) => onChange({ alignment: e.target.value }, "alignment")}>
          <option value="">Sin alineamiento</option>
          {ALIGNMENTS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        {values.alignment && (
          <p className="mt-1 text-sm text-muted">{ALIGNMENTS.find((a) => a.id === values.alignment)?.description}</p>
        )}
        <FieldError errors={errors} keys={["alignment"]} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="age" className={labelClass}>Edad</label>
          <input id="age" className={field} maxLength={LIMITS.age} value={values.age} onChange={(e) => onChange({ age: e.target.value }, "age")} />
          <FieldError errors={errors} keys={["age"]} />
        </div>
        <div>
          <label htmlFor="xp" className={labelClass}>Puntos de experiencia</label>
          <input
            id="xp"
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_XP}
            step={1}
            className={field}
            value={values.xp}
            placeholder="0"
            onChange={(e) => onChange({ xp: e.target.value }, "xp")}
          />
          <FieldError errors={errors} keys={["xp"]} />
        </div>
      </div>
      <div>
        <label htmlFor="appearance" className={labelClass}>Apariencia</label>
        <textarea id="appearance" rows={3} className={field} maxLength={LIMITS.appearance} value={values.appearance} onChange={(e) => onChange({ appearance: e.target.value }, "appearance")} />
        <FieldError errors={errors} keys={["appearance"]} />
      </div>
      <div>
        <label htmlFor="backstory" className={labelClass}>Historia</label>
        <BbcodeEditor id="backstory" value={values.backstory} onChange={(v) => onChange({ backstory: v }, "backstory")} />
        <FieldError errors={errors} keys={["backstory"]} />
      </div>
      <div>
        <label htmlFor="languages" className={labelClass}>Idiomas</label>
        <input id="languages" className={field} maxLength={LIMITS.languages} value={values.languages} onChange={(e) => onChange({ languages: e.target.value }, "languages")} />
        <FieldError errors={errors} keys={["languages"]} />
      </div>
      <div>
        <label htmlFor="notes" className={labelClass}>Notas</label>
        <textarea id="notes" rows={4} className={field} maxLength={LIMITS.notes} value={values.notes} onChange={(e) => onChange({ notes: e.target.value }, "notes")} />
        <FieldError errors={errors} keys={["notes"]} />
      </div>
    </div>
  );
}
