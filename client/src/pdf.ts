import { jsPDF } from 'jspdf';
import type { Profile, MealPlan } from './types';
import { ACTIVITY_FACTORS, recommendedProtein, computeSubstitute } from './types';

const MARGIN = 14;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;

const GOAL_LABELS: Record<string, string> = {
  maintain: 'Maintain current physique',
  build_muscle: 'Build muscle',
  lose_weight: 'Lose weight',
};

function getPct(grams: number, kcalPerGram: number, totalCal: number): number {
  if (totalCal <= 0) return 0;
  return Math.round((grams * kcalPerGram / totalCal) * 100);
}

function buildDoc(profile: Profile, plans: MealPlan[]): jsPDF {
  const doc = new jsPDF();
  let y = 0;

  const addText = (text: string, size = 10, bold = false, x = MARGIN) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(text, x, y);
    y += size * 0.5 + 2;
  };

  const addLine = () => {
    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 4;
  };

  // ─── PAGE 1: Profile & Biometrics ─────────────────────────────
  y = 25;

  // Title
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Meal Prep Plan', MARGIN, y);
  y += 10;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(profile.name, MARGIN, y);
  y += 10;

  addLine();

  // Biometrics section
  addText('Biometrics', 14, true);
  y += 2;

  const bioRows = [
    ['Age', `${profile.age}`],
    ['Gender', profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1)],
    ['Weight', `${profile.weight_kg} kg`],
    ['Height', `${profile.height_cm} cm`],
    ['Activity Level', ACTIVITY_FACTORS[profile.activity_level]?.label ?? profile.activity_level],
    ['Goal', GOAL_LABELS[profile.goal] ?? profile.goal],
  ];

  for (const [label, value] of bioRows) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(label, MARGIN + 4, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, MARGIN + 50, y);
    y += 6;
  }

  y += 4;

  // TDEE heading
  addText('Estimated TDEE', 12, true);
  y += 2;

  // TDEE boxes
  const boxW = (CONTENT_W - 4) / 2;
  const workoutTdee = Math.round(profile.tdee * 1.1);

  // Non-Workout
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.roundedRect(MARGIN, y, boxW, 18, 3, 3, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(6, 95, 70);
  doc.text('Non-Workout Day', MARGIN + boxW / 2, y + 6, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`${profile.tdee} kcal / day`, MARGIN + boxW / 2, y + 14, { align: 'center' });

  // Workout
  const boxX2 = MARGIN + boxW + 4;
  doc.setFillColor(219, 234, 254); // blue-100
  doc.roundedRect(boxX2, y, boxW, 18, 3, 3, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(29, 78, 216); // blue-700
  doc.text('Workout Day', boxX2 + boxW / 2, y + 6, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`${workoutTdee} kcal / day`, boxX2 + boxW / 2, y + 14, { align: 'center' });

  doc.setTextColor(0);
  y += 26;

  addLine();
  y += 4;

  // Protein recommendation
  const proteinRec = recommendedProtein(profile.weight_kg, profile.goal);
  addText('Recommended Protein Intake', 14, true);
  addText(`${proteinRec.min} – ${proteinRec.max} g / day`, 12);
  y += 4;

  addLine();
  y += 4;

  // Macro split overview for each plan (workout first)
  addText('Macro Targets Overview', 14, true);
  y += 2;

  const sortedPlans = [...plans].sort((a, b) =>
    a.plan_type === 'workout' ? -1 : b.plan_type === 'workout' ? 1 : 0
  );

  for (const plan of sortedPlans) {
    const label = plan.plan_type === 'workout' ? 'Workout Day' : 'Non-Workout Day';
    const pPct = getPct(plan.protein_target, 4, plan.calorie_target);
    const cPct = getPct(plan.carbs_target, 4, plan.calorie_target);
    const fPct = getPct(plan.fat_target, 9, plan.calorie_target);

    addText(label, 11, true);
    addText(`  Calories: ${plan.calorie_target} kcal`);
    addText(`  Protein:  ${plan.protein_target}g  (${pPct}%)`);
    addText(`  Carbs:    ${plan.carbs_target}g  (${cPct}%)`);
    addText(`  Fat:      ${plan.fat_target}g  (${fPct}%)`);
    y += 4;
  }

  // ─── PAGE 2+: One page per plan (workout first) ────────────────
  for (const plan of sortedPlans) {
    doc.addPage();
    y = 25;

    const dayLabel = plan.plan_type === 'workout' ? 'Workout Day' : 'Non-Workout Day';

    // Day header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(dayLabel, MARGIN, y);
    y += 8;

    // Compute actuals
    const totals = plan.items.reduce(
      (a, i) => ({ cal: a.cal + i.calories, p: a.p + i.protein, c: a.c + i.carbs, f: a.f + i.fat }),
      { cal: 0, p: 0, c: 0, f: 0 }
    );

    // Targets bar
    const pPct = getPct(plan.protein_target, 4, plan.calorie_target);
    const cPct = getPct(plan.carbs_target, 4, plan.calorie_target);
    const fPct = getPct(plan.fat_target, 9, plan.calorie_target);

    doc.setFillColor(240, 240, 240);
    doc.roundedRect(MARGIN, y, CONTENT_W, 12, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60);
    doc.text(
      `Target:  ${plan.calorie_target} kcal   |   P: ${plan.protein_target}g (${pPct}%)   |   C: ${plan.carbs_target}g (${cPct}%)   |   F: ${plan.fat_target}g (${fPct}%)`,
      PAGE_W / 2, y + 7.5, { align: 'center' }
    );
    doc.setTextColor(0);
    y += 14;

    // Actual totals bar
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(MARGIN, y, CONTENT_W, 12, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(6, 95, 70);
    doc.text(
      `Actual:  ${Math.round(totals.cal)} kcal   |   P: ${Math.round(totals.p)}g   |   C: ${Math.round(totals.c)}g   |   F: ${Math.round(totals.f)}g`,
      PAGE_W / 2, y + 7.5, { align: 'center' }
    );
    doc.setTextColor(0);
    y += 14;

    // Remaining budget
    const remCal = plan.calorie_target - totals.cal;
    const remP = plan.protein_target - totals.p;
    const remC = plan.carbs_target - totals.c;
    const remF = plan.fat_target - totals.f;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(
      `Remaining:  ${Math.round(remCal)} kcal  |  P: ${Math.round(remP)}g  |  C: ${Math.round(remC)}g  |  F: ${Math.round(remF)}g`,
      PAGE_W / 2, y, { align: 'center' }
    );
    doc.setTextColor(0);
    y += 8;

    // Meals
    const mealLabels = [...new Set(plan.items.map((i) => i.meal_label))];
    for (const meal of mealLabels) {
      // Check if we need a new page
      if (y > 255) {
        doc.addPage();
        y = 25;
      }

      // Meal header
      doc.setFillColor(249, 250, 251); // gray-50
      doc.roundedRect(MARGIN, y, CONTENT_W, 8, 1.5, 1.5, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(meal, MARGIN + 3, y + 5.5);

      const items = plan.items.filter((i) => i.meal_label === meal);
      const sub = items.reduce(
        (a, i) => ({ cal: a.cal + i.calories, p: a.p + i.protein, c: a.c + i.carbs, f: a.f + i.fat }),
        { cal: 0, p: 0, c: 0, f: 0 }
      );
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(
        `${Math.round(sub.cal)} kcal | P: ${Math.round(sub.p)}g | C: ${Math.round(sub.c)}g | F: ${Math.round(sub.f)}g`,
        PAGE_W - MARGIN - 3, y + 5.5, { align: 'right' }
      );
      y += 12;

      // Table header
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(120);
      doc.text('Food', MARGIN + 2, y);
      doc.text('Serving', MARGIN + 57, y);
      doc.text('Qty', MARGIN + 77, y, { align: 'right' });
      doc.text('Total', MARGIN + 81, y);
      doc.text('Cal', MARGIN + 104, y, { align: 'right' });
      doc.text('P (g)', MARGIN + 121, y, { align: 'right' });
      doc.text('C (g)', MARGIN + 138, y, { align: 'right' });
      doc.text('F (g)', MARGIN + 155, y, { align: 'right' });
      doc.setTextColor(0);
      y += 5;

      // Items
      doc.setFontSize(9);
      items.forEach((item, rowIdx) => {
        const subCount = item.substitutes?.length ?? 0;
        const rowHeight = 5 + subCount * 4.5;
        if (y > 275 - rowHeight) {
          doc.addPage();
          y = 25;
        }

        // Alternating row background
        if (rowIdx % 2 === 1) {
          doc.setFillColor(245, 245, 245);
          doc.rect(MARGIN, y - 3.5, CONTENT_W, 5.5, 'F');
        }

        const match = item.serving_size.match(/^([\d.]+)\s*(.*)$/);
        const totalServing = match
          ? `${Math.round(parseFloat(match[1]) * (item.multiplier ?? 1) * 10) / 10}${match[2]}`
          : item.serving_size;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(0);
        doc.text(item.food_name, MARGIN + 2, y);
        doc.text(item.serving_size, MARGIN + 57, y);
        doc.text(`${item.multiplier ?? 1}x`, MARGIN + 77, y, { align: 'right' });
        doc.text(totalServing, MARGIN + 81, y);
        doc.setFont('helvetica', 'bold');
        doc.text(`${Math.round(item.calories)}`, MARGIN + 104, y, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.text(`${Math.round(item.protein)}`, MARGIN + 121, y, { align: 'right' });
        doc.text(`${Math.round(item.carbs)}`, MARGIN + 138, y, { align: 'right' });
        doc.text(`${Math.round(item.fat)}`, MARGIN + 155, y, { align: 'right' });
        y += 5;

        // Substitute rows
        if (subCount > 0) {
          doc.setFontSize(8);
          doc.setTextColor(120);
          for (const sub of item.substitutes!) {
            const c = computeSubstitute(sub, item.calories);
            doc.setFont('helvetica', 'italic');
            doc.text(`↳ ${sub.food_name}`, MARGIN + 6, y);
            doc.setFont('helvetica', 'normal');
            doc.text(c.totalServing, MARGIN + 81, y);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(80);
            doc.text(`${c.calories}`, MARGIN + 104, y, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(120);
            y += 4.5;
          }
          doc.setTextColor(0);
          doc.setFontSize(9);
        }
      });
      y += 4;
    }

  }

  return doc;
}

export function exportPDF(profile: Profile, plans: MealPlan[]) {
  buildDoc(profile, plans).save(`${profile.name.replace(/\s+/g, '_')}_meal_plan.pdf`);
}

export function previewPDFUrl(profile: Profile, plans: MealPlan[]): string {
  return buildDoc(profile, plans).output('bloburl') as unknown as string;
}
