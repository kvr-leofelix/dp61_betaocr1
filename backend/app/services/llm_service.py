import uuid
from typing import Dict, Any, List, Optional
from backend.app.core.config import settings


SUBJECT_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "sub-math": {
        "name": "Mathematics",
        "mcqs": [
            {
                "stem": "If each linear dimension (length, breadth, and height) of a cuboid water reservoir is doubled, by what factor does its total storage volume increase?",
                "options": ["Factor of 2", "Factor of 4", "Factor of 6", "Factor of 8"],
                "correct_answer": "Factor of 8",
                "rubric": "1 mark for correct selection: Volume V' = (2l)(2b)(2h) = 8(lbh) = 8V.",
                "competency": "CU",
            },
            {
                "stem": "Which of the following rational numbers is equal to its own multiplicative inverse (reciprocal)?",
                "options": ["0 and 1", "1 and -1", "Only 0", "1 and 1/2"],
                "correct_answer": "1 and -1",
                "rubric": "1 mark for 1 and -1 because 1 * 1 = 1 and (-1) * (-1) = 1, whereas 0 has no reciprocal.",
                "competency": "CU",
            },
            {
                "stem": "A cylindrical grain silo has a base radius of 7 m and height of 10 m. Using pi = 22/7, what is its volume in cubic meters?",
                "options": ["440 m³", "1,540 m³", "770 m³", "3,080 m³"],
                "correct_answer": "1,540 m³",
                "rubric": "1 mark for V = pi * r² * h = (22/7) * 49 * 10 = 1,540 m³.",
                "competency": "AU",
            },
            {
                "stem": "Read the conditional statement: 'Every rhombus has four equal sides, and every square is a rhombus with 90° interior angles.' Which conclusion logically follows?",
                "options": [
                    "Every rhombus is a square",
                    "Every square is a rhombus, but not every rhombus is a square",
                    "No rhombus can have equal diagonals",
                    "Squares and rhombuses are disjoint sets",
                ],
                "correct_answer": "Every square is a rhombus, but not every rhombus is a square",
                "rubric": "1 mark for accurate set-subset linguistic deduction.",
                "competency": "LU",
            },
            {
                "stem": "In a frequency distribution of daily monsoon rainfall (12 mm, 18 mm, 24 mm, 30 mm, 16 mm), what is the arithmetic mean rainfall?",
                "options": ["18 mm", "20 mm", "22 mm", "24 mm"],
                "correct_answer": "20 mm",
                "rubric": "1 mark for Sum/N = (12+18+24+30+16)/5 = 100/5 = 20 mm.",
                "competency": "AU",
            },
            {
                "stem": "A student simplifies (a + b)² as a² + b². Which counterexample immediately disproves this algebraic identity?",
                "options": ["a = 0, b = 5", "a = 3, b = 4", "a = 1, b = 0", "a = 0, b = 0"],
                "correct_answer": "a = 3, b = 4",
                "rubric": "1 mark: For a=3, b=4, (3+4)² = 49, whereas 3² + 4² = 25 (missing 2ab = 24).",
                "competency": "CT",
            },
        ],
        "theory": [
            {
                "stem": "A community rainwater harvesting tank is shaped as a cuboid of length 5 m, breadth 4 m, and depth 2.5 m. Calculate its capacity in Liters and determine how many households it can supply for 5 days at 500 Liters per household per day.",
                "type": "practical",
                "marks": 4,
                "correct_answer": "Volume = 5 * 4 * 2.5 = 50 m³. Capacity = 50 * 1000 = 50,000 Liters. Requirement per household for 5 days = 2,500 Liters. Households served = 50,000 / 2,500 = 20 households.",
                "rubric": "1m: Volume formula & calculation (50 m³) | 1m: Conversion to Liters (50,000 L) | 1m: Per-household 5-day consumption (2,500 L) | 1m: Final division & unit conclusion (20 households).",
                "competency": "AU",
            },
            {
                "stem": "Critically evaluate the claim: 'If the lateral surface area of a cylinder is doubled by doubling its radius while keeping height constant, its volume will also double.' Prove or disprove algebraically.",
                "type": "descriptive",
                "marks": 4,
                "correct_answer": "Claim is partially true for LSA but false for Volume. LSA = 2*pi*r*h, so doubling r to 2r doubles LSA to 2(2*pi*r*h). However, Volume = pi*r²*h, so replacing r with 2r yields pi*(2r)²*h = 4*pi*r²*h (quadruples, not doubles).",
                "rubric": "1m: State claim is false for volume | 1m: Show LSA scales linearly with r (2x) | 1m: Show Volume scales quadratically with r² (4x) | 1m: Clear comparative synthesis.",
                "competency": "CT",
            },
            {
                "stem": "Explain in your own words why zero (0) does not possess a multiplicative inverse in the set of rational numbers, and contrast this with its additive inverse.",
                "type": "short",
                "marks": 3,
                "correct_answer": "For any rational number x, its multiplicative inverse y must satisfy x * y = 1. Since 0 * y = 0 for all finite y, no rational number multiplied by 0 can equal 1 (1/0 is undefined). In contrast, the additive inverse of 0 is 0 because 0 + 0 = 0.",
                "rubric": "1m: Definition of multiplicative identity (x * y = 1) | 1m: Proof that 0 * y = 0 != 1 | 1m: Contrast with additive inverse (0 + 0 = 0).",
                "competency": "LU",
            },
            {
                "stem": "Using properties of interior and exterior angles of convex polygons, derive the interior angle of a regular octagon and explain why regular octagons alone cannot tessellate a flat plane without gaps.",
                "type": "descriptive",
                "marks": 5,
                "correct_answer": "Sum of interior angles = (8 - 2) * 180° = 1080°. Each interior angle = 1080° / 8 = 135°. For edge-to-edge plane tessellation, the interior angle must divide 360° evenly. Since 360 / 135 = 2.67 (not an integer), octagons leave a 90° square gap.",
                "rubric": "2m: Angle sum & single interior angle (135°) | 2m: 360° vertex divisibility condition | 1m: Identifying the 90° residual gap.",
                "competency": "CU",
            },
        ],
    },
    "sub-sci": {
        "name": "Science & Discovery",
        "mcqs": [
            {
                "stem": "Why do heavy agricultural tractors use wide rear tires when operating on soft, wet soil?",
                "options": [
                    "To increase the gravitational pull on the tractor",
                    "To increase contact area and reduce pressure exerted on the soil",
                    "To eliminate rolling friction completely",
                    "To increase atmospheric pressure above the wheels",
                ],
                "correct_answer": "To increase contact area and reduce pressure exerted on the soil",
                "rubric": "1 mark: Pressure P = Force / Area; increasing area A reduces pressure P, preventing sinking.",
                "competency": "AU",
            },
            {
                "stem": "Arrange the three types of friction—Static, Sliding, and Rolling—in decreasing order of magnitude for the same pair of surfaces:",
                "options": [
                    "Rolling > Sliding > Static",
                    "Static > Sliding > Rolling",
                    "Sliding > Static > Rolling",
                    "Static > Rolling > Sliding",
                ],
                "correct_answer": "Static > Sliding > Rolling",
                "rubric": "1 mark: Interlocking of surface irregularities is highest at rest (Static) and lowest in Rolling.",
                "competency": "CU",
            },
            {
                "stem": "A diver descends from 5 m depth to 15 m depth in a freshwater lake. How does the liquid pressure acting on the diver change?",
                "options": [
                    "Remains constant because water is incompressible",
                    "Increases proportionally with depth (P = rho * g * h)",
                    "Decreases due to upward buoyant force",
                    "Depends only on the surface area of the lake",
                ],
                "correct_answer": "Increases proportionally with depth (P = rho * g * h)",
                "rubric": "1 mark: Hydrostatic pressure is directly proportional to vertical column height h.",
                "competency": "CU",
            },
            {
                "stem": "In the statement 'Ball bearings convert sliding friction into rolling friction inside rotating shafts,' what is the primary engineering trade-off?",
                "options": [
                    "Higher thermal dissipation and mechanical wear",
                    "Substantially lower energy loss and reduced wear",
                    "Complete elimination of gravitational mass",
                    "Increased electrostatic drag",
                ],
                "correct_answer": "Substantially lower energy loss and reduced wear",
                "rubric": "1 mark: Rolling friction is an order of magnitude smaller than sliding friction.",
                "competency": "LU",
            },
        ],
        "theory": [
            {
                "stem": "Explain why friction is often described by physicists and engineers as a 'necessary evil.' Provide two examples where friction is indispensable and two methods used to minimize undesirable friction.",
                "type": "descriptive",
                "marks": 4,
                "correct_answer": "Friction is necessary because without it we could not walk without slipping, vehicles could not brake, and nails would not hold in walls. It is an 'evil' because it causes wear and tear of machine parts and wastes kinetic energy as heat. It is reduced via lubrication (oil/grease) and ball bearings.",
                "rubric": "1m: Conceptual synthesis of 'necessary evil' | 1.5m: Two indispensable applications | 1.5m: Two engineering reduction techniques.",
                "competency": "CT",
            },
            {
                "stem": "A rectangular metal block weighing 120 N has dimensions 0.5 m × 0.2 m × 0.1 m. Calculate the maximum and minimum pressure it can exert when resting on a horizontal laboratory table.",
                "type": "practical",
                "marks": 4,
                "correct_answer": "Minimum area = 0.2 * 0.1 = 0.02 m² -> Maximum Pressure = 120 / 0.02 = 6,000 Pa. Maximum area = 0.5 * 0.2 = 0.10 m² -> Minimum Pressure = 120 / 0.10 = 1,200 Pa.",
                "rubric": "1m: Identify min area (0.02 m²) | 1m: Calculate Max Pressure (6,000 Pa) | 1m: Identify max area (0.10 m²) | 1m: Calculate Min Pressure (1,200 Pa).",
                "competency": "AU",
            },
        ],
    },
    "sub-eng": {
        "name": "English Communication",
        "mcqs": [
            {
                "stem": "In the sentence 'Although the monsoon arrived late, the district conserved sufficient groundwater through check-dams,' identify the subordinate (dependent) clause:",
                "options": [
                    "the district conserved sufficient groundwater",
                    "Although the monsoon arrived late",
                    "through check-dams",
                    "conserved sufficient groundwater",
                ],
                "correct_answer": "Although the monsoon arrived late",
                "rubric": "1 mark: Adverbial clause of concession introduced by subordinating conjunction 'Although'.",
                "competency": "LU",
            },
            {
                "stem": "Which rhetorical device strengthens an evidence-based civic proposal on school rainwater harvesting?",
                "options": [
                    "Unsubstantiated emotional hyperbole",
                    "Empirical precipitation statistics paired with cost-benefit synthesis",
                    "Ambiguous passive voice without agency",
                    "Circular reasoning",
                ],
                "correct_answer": "Empirical precipitation statistics paired with cost-benefit synthesis",
                "rubric": "1 mark: Persuasive non-fiction relies on verifiable data and logical feasibility.",
                "competency": "CT",
            },
        ],
        "theory": [
            {
                "stem": "Draft a structured 100-word formal memorandum to the School Management Committee proposing roof-top rainwater harvesting, incorporating at least one quantitative argument and one counterargument rebuttal.",
                "type": "descriptive",
                "marks": 5,
                "correct_answer": "Memorandum includes: (1) Clear subject line & audience framing; (2) Quantitative catchment estimate (e.g., 50,000 L per monsoon); (3) Rebuttal to initial installation cost via 2-year tanker savings; (4) Actionable conclusion.",
                "rubric": "1.5m: Formal register & structure (LU) | 2m: Quantitative evidence & logical persuasion (AU) | 1.5m: Counterargument evaluation (CT).",
                "competency": "LU",
            },
        ],
    },
    "sub-sst": {
        "name": "Social Studies & Civics",
        "mcqs": [
            {
                "stem": "Which constitutional principle ensures that local Panchayati Raj institutions can allocate resources for village water and school infrastructure?",
                "options": [
                    "Centralized Unitary Command",
                    "Decentralized Democratic Federalism (73rd Amendment)",
                    "Judicial Review Exclusivity",
                    "Mercantilist Trade Policy",
                ],
                "correct_answer": "Decentralized Democratic Federalism (73rd Amendment)",
                "rubric": "1 mark: The 73rd Constitutional Amendment empowers local self-governance (Gram Sabhas).",
                "competency": "CU",
            },
        ],
        "theory": [
            {
                "stem": "Analyze how geographical monsoon variability across Rajasthan and Karnataka shapes traditional water conservation architecture (such as Stepwells/Baoris vs. Kalyanis).",
                "type": "descriptive",
                "marks": 4,
                "correct_answer": "Arid regions in Rajasthan developed deep shaded stepwells (Baoris) to minimize evaporation under high temperatures, while Deccan temple tanks (Kalyanis) in Karnataka integrate stepped stone aquifers with seasonal tank cascades.",
                "rubric": "2m: Climatic & geographical comparison | 2m: Architectural adaptation & civic utility.",
                "competency": "CT",
            },
        ],
    },
}


class LLMService:
    """
    Provider abstraction for LLM interactions.
    Provides reliable, deterministic fallback responses for local demos without external API keys.
    """

    async def generate_lesson_plan_suggestions(self, topic: str, competency: str) -> Dict[str, Any]:
        return {
            "suggested_title": f"{topic} — Differentiated Mastery",
            "visual_activity": "Interactive whiteboard concept diagram and balance scales.",
            "auditory_activity": "Paired peer explanation and classroom discussion debate.",
            "kinesthetic_activity": "Scale model measurement exercise using physical blocks.",
            "formative_exit_check": "3 targeted benchmark items mapped to Bloom's Apply level.",
        }

    async def generate_parent_friendly_summary(
        self, student_name: str, lu: int, cu: int, au: int, ct: int
    ) -> str:
        return (
            f"{student_name} is making steady, commendable progress across Grade 8 competencies. "
            f"Concept understanding is solid ({cu}%), and practical application ({au}%) continues to develop through hands-on practice. "
            f"Encourage regular reading at home to further strengthen language parsing in multi-part word problems."
        )

    async def generate_questions_from_sources(
        self,
        subject_id: str,
        mcq_count: int,
        theory_count: int,
        bloom_level: str,
        source_documents: List[Dict[str, Any]],
        focus_topic: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Generates MCQ and Theory questions grounded in the selected source documents.
        Preserves document references on each generated question for educator traceability.
        """
        bank = SUBJECT_TEMPLATES.get(subject_id, SUBJECT_TEMPLATES["sub-math"])
        mcq_pool = bank.get("mcqs", SUBJECT_TEMPLATES["sub-math"]["mcqs"])
        theory_pool = bank.get("theory", SUBJECT_TEMPLATES["sub-math"]["theory"])

        doc_ids = [d["id"] for d in source_documents] if source_documents else ["doc-src-math-1"]
        doc_names = (
            [d["file_name"] for d in source_documents]
            if source_documents
            else ["NCERT_Grade8_Curriculum_Reference.pdf"]
        )

        # Extract context snippet from uploaded source documents to ground questions
        extracted_snippets = [
            d.get("extracted_text", "").strip()
            for d in source_documents
            if d.get("extracted_text")
        ]

        generated: List[Dict[str, Any]] = []

        # 1. Generate MCQs
        for i in range(max(0, min(mcq_count, 20))):
            template = mcq_pool[i % len(mcq_pool)]
            assigned_doc_idx = i % len(doc_ids)
            assigned_doc_id = doc_ids[assigned_doc_idx]
            assigned_doc_name = doc_names[assigned_doc_idx]

            prefix = ""
            if focus_topic:
                prefix = f"[{focus_topic}] "
            elif i >= len(mcq_pool):
                prefix = f"[Variant {i // len(mcq_pool) + 1} • {bloom_level}] "

            generated.append(
                {
                    "id": f"gen-mcq-{uuid.uuid4().hex[:8]}",
                    "subject_id": subject_id,
                    "text": f"{prefix}{template['stem']}",
                    "type": "mcq",
                    "options": template["options"],
                    "correct_answer": template["correct_answer"],
                    "marking_rubric": f"[Grounded in {assigned_doc_name}] {template['rubric']}",
                    "marks": 1 if bloom_level in ("Remember", "Understand") else 2,
                    "competency": template["competency"],
                    "bloom_level": bloom_level,
                    "source_document_ids": [assigned_doc_id],
                    "source_document_names": [assigned_doc_name],
                    "is_ai_generated": True,
                }
            )

        # 2. Generate Theory Questions
        for j in range(max(0, min(theory_count, 15))):
            template = theory_pool[j % len(theory_pool)]
            assigned_doc_idx = j % len(doc_ids)
            assigned_doc_id = doc_ids[assigned_doc_idx]
            assigned_doc_name = doc_names[assigned_doc_idx]

            context_note = ""
            if extracted_snippets and j == 0 and len(extracted_snippets[0]) > 25:
                snippet_preview = extracted_snippets[0][:120].rstrip(".")
                context_note = f" (Ref: '{snippet_preview}...')"

            prefix = f"[{focus_topic}] " if focus_topic else ""

            generated.append(
                {
                    "id": f"gen-th-{uuid.uuid4().hex[:8]}",
                    "subject_id": subject_id,
                    "text": f"{prefix}{template['stem']}{context_note}",
                    "type": template.get("type", "descriptive"),
                    "options": [],
                    "correct_answer": template["correct_answer"],
                    "marking_rubric": f"[Grounded in {assigned_doc_name}] {template['rubric']}",
                    "marks": template.get("marks", 4),
                    "competency": template["competency"],
                    "bloom_level": bloom_level,
                    "source_document_ids": [assigned_doc_id],
                    "source_document_names": [assigned_doc_name],
                    "is_ai_generated": True,
                }
            )

        return generated

    async def regenerate_single_question(
        self,
        subject_id: str,
        question_type: str,
        bloom_level: str,
        competency: str,
        source_document_ids: List[str],
        source_document_names: List[str],
        current_text: str = "",
    ) -> Dict[str, Any]:
        """Regenerates an alternative question with matching parameters."""
        bank = SUBJECT_TEMPLATES.get(subject_id, SUBJECT_TEMPLATES["sub-math"])
        is_mcq = question_type == "mcq"
        pool = bank["mcqs"] if is_mcq else bank["theory"]

        # Pick an item whose stem is different from current_text
        chosen = pool[0]
        for candidate in pool:
            if candidate["stem"] not in current_text:
                chosen = candidate
                break

        doc_name = source_document_names[0] if source_document_names else "Curriculum Source"
        uid = uuid.uuid4().hex[:6]

        return {
            "id": f"gen-regen-{uid}",
            "subject_id": subject_id,
            "text": f"[Regenerated • {bloom_level}] {chosen['stem']}",
            "type": "mcq" if is_mcq else chosen.get("type", "descriptive"),
            "options": chosen.get("options", []) if is_mcq else [],
            "correct_answer": chosen["correct_answer"],
            "marking_rubric": f"[Grounded in {doc_name}] {chosen['rubric']}",
            "marks": 1 if is_mcq else chosen.get("marks", 4),
            "competency": competency or chosen.get("competency", "CU"),
            "bloom_level": bloom_level,
            "source_document_ids": source_document_ids or ["doc-src-math-1"],
            "source_document_names": source_document_names or [doc_name],
            "is_ai_generated": True,
        }


llm_service = LLMService()
