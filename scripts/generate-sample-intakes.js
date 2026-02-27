#!/usr/bin/env node

/**
 * Generate Sample Intake Reports for All Practice Areas
 *
 * Uses Claude to generate realistic sample intake reports with full
 * conversation transcripts for each of the 23 consolidated practice areas.
 *
 * Usage:
 *   node scripts/generate-sample-intakes.js [--area=personal_injury] [--dry-run]
 *
 * Options:
 *   --area=KEY     Generate only for specific practice area (e.g., --area=bankruptcy)
 *   --dry-run      Show what would be generated without writing files
 *   --list         List all practice areas and exit
 *
 * Output:
 *   preintake/data/sample-intakes.json
 */

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

// Load API key from secrets
const apiKeyPath = path.join(__dirname, '../secrets/Anthropic-API-Key');
const apiKey = fs.existsSync(apiKeyPath)
  ? fs.readFileSync(apiKeyPath, 'utf8').trim()
  : process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.error('Error: Anthropic API key not found');
  console.error('Expected at: secrets/Anthropic-API-Key or ANTHROPIC_API_KEY env var');
  process.exit(1);
}

// Initialize Anthropic client
const anthropic = new Anthropic({ apiKey });

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIST_ONLY = args.includes('--list');
const SPECIFIC_AREA = args.find(a => a.startsWith('--area='))?.split('=')[1];

/**
 * 23 Consolidated Practice Areas (from 40 raw terms)
 * Each includes context for generating realistic samples
 */
const PRACTICE_AREAS = {
  personal_injury: {
    name: 'Personal Injury',
    rawTerms: ['Personal Injury'],
    commonCases: ['car accidents', 'slip and fall', 'motorcycle accidents', 'pedestrian accidents', 'dog bites'],
    qualificationFactors: ['clear liability', 'documented injuries', 'medical treatment', 'police report', 'witnesses', 'insurance coverage'],
    typicalConcerns: ['pre-existing conditions', 'delayed treatment', 'shared fault', 'statute of limitations'],
    recommendedQualification: 'green', // Most PI cases should show green as the example
  },

  bankruptcy: {
    name: 'Bankruptcy',
    rawTerms: ['Bankruptcy'],
    commonCases: ['Chapter 7 liquidation', 'Chapter 13 repayment plan', 'credit card debt', 'medical debt', 'foreclosure prevention'],
    qualificationFactors: ['income level for chapter determination', 'asset disclosure', 'no recent bankruptcy filing', 'consistent income for Chapter 13'],
    typicalConcerns: ['recent luxury purchases', 'recent balance transfers', 'income too high for Chapter 7', 'non-dischargeable debts'],
    recommendedQualification: 'green',
  },

  family_law: {
    name: 'Family Law',
    rawTerms: ['Family Law', 'Family'],
    commonCases: ['divorce', 'child custody', 'child support modification', 'adoption', 'prenuptial agreements'],
    qualificationFactors: ['jurisdiction established', 'children involved', 'asset complexity', 'cooperative co-parent'],
    typicalConcerns: ['domestic violence history', 'interstate custody issues', 'hidden assets suspected', 'parental alienation'],
    recommendedQualification: 'green',
  },

  medical_malpractice: {
    name: 'Medical Malpractice',
    rawTerms: ['Medical Malpractice'],
    commonCases: ['surgical errors', 'misdiagnosis', 'medication errors', 'birth injuries', 'failure to treat'],
    qualificationFactors: ['clear deviation from standard of care', 'documented damages', 'medical records available', 'expert willing to testify'],
    typicalConcerns: ['known complication vs negligence', 'statute of limitations', 'causation unclear', 'minimal damages'],
    recommendedQualification: 'yellow', // Med mal often needs expert review
  },

  workers_compensation: {
    name: "Workers' Compensation",
    rawTerms: ['Workers Compensation', "Workers' Compensation"],
    commonCases: ['workplace injuries', 'repetitive stress injuries', 'occupational illness', 'construction accidents', 'denied claims'],
    qualificationFactors: ['injury occurred at work', 'reported to employer', 'medical treatment received', 'claim filed or ready to file'],
    typicalConcerns: ['pre-existing condition', 'independent contractor status', 'employer disputes work-relatedness', 'missed filing deadline'],
    recommendedQualification: 'green',
  },

  elder_law: {
    name: 'Elder Law',
    rawTerms: ['Elder Law', 'Elder'],
    commonCases: ['Medicaid planning', 'nursing home issues', 'guardianship', 'elder abuse', 'asset protection'],
    qualificationFactors: ['client or family member over 65', 'long-term care concerns', 'asset preservation needs', 'capacity issues addressed'],
    typicalConcerns: ['Medicaid lookback period', 'family conflicts', 'existing powers of attorney', 'urgency of placement'],
    recommendedQualification: 'green',
  },

  immigration: {
    name: 'Immigration',
    rawTerms: ['Immigration', 'Immigration and Naturalization', 'Immigration & Naturalization', 'Immigration and Nationality'],
    commonCases: ['family-based green card', 'employment visa', 'naturalization', 'asylum', 'deportation defense', 'DACA renewal'],
    qualificationFactors: ['current status documented', 'no criminal history', 'qualifying relationship exists', 'employer sponsorship available'],
    typicalConcerns: ['prior deportation order', 'criminal record', 'overstay history', 'pending removal proceedings'],
    recommendedQualification: 'green',
  },

  insurance: {
    name: 'Insurance',
    rawTerms: ['Insurance'],
    commonCases: ['denied claims', 'bad faith', 'coverage disputes', 'underinsured motorist claims', 'property damage claims'],
    qualificationFactors: ['policy in effect', 'claim properly filed', 'denial letter received', 'damages documented'],
    typicalConcerns: ['policy exclusions apply', 'late notice to insurer', 'pre-existing damage', 'coverage limits exhausted'],
    recommendedQualification: 'green',
  },

  real_estate: {
    name: 'Real Estate',
    rawTerms: ['Real Estate'],
    commonCases: ['purchase/sale transactions', 'title disputes', 'landlord-tenant issues', 'boundary disputes', 'HOA disputes'],
    qualificationFactors: ['property clearly identified', 'documentation available', 'parties identified', 'timeline reasonable'],
    typicalConcerns: ['clouded title', 'undisclosed defects', 'contract already signed', 'commercial vs residential complexity'],
    recommendedQualification: 'green',
  },

  criminal_defense: {
    name: 'Criminal Defense',
    rawTerms: ['Criminal', 'Criminal Law', 'Criminal Defense'],
    commonCases: ['DUI/DWI', 'drug charges', 'assault', 'theft', 'white collar crimes', 'domestic violence'],
    qualificationFactors: ['charges filed or pending', 'no current representation', 'court date known', 'bail status clear'],
    typicalConcerns: ['federal vs state charges', 'prior convictions', 'probation violations', 'co-defendants'],
    recommendedQualification: 'yellow', // Criminal often needs urgency review
  },

  civil_litigation: {
    name: 'Civil Litigation',
    rawTerms: ['Civil Litigation'],
    commonCases: ['contract disputes', 'business torts', 'fraud claims', 'collection matters', 'injunctive relief'],
    qualificationFactors: ['clear cause of action', 'damages quantifiable', 'defendant identifiable and collectible', 'statute of limitations met'],
    typicalConcerns: ['defendant judgment-proof', 'complex multi-party issues', 'arbitration clause', 'document discovery burden'],
    recommendedQualification: 'green',
  },

  civil_rights: {
    name: 'Civil Rights',
    rawTerms: ['Civil Rights'],
    commonCases: ['employment discrimination', 'police misconduct', 'housing discrimination', 'disability accommodation', 'voting rights'],
    qualificationFactors: ['protected class status', 'adverse action documented', 'exhausted administrative remedies', 'timeline within limits'],
    typicalConcerns: ['EEOC filing deadline', 'government immunity issues', 'at-will employment defense', 'comparator evidence weak'],
    recommendedQualification: 'yellow',
  },

  employment_law: {
    name: 'Employment Law',
    rawTerms: ['Labor & Employment', 'Labor and Employment'],
    commonCases: ['wrongful termination', 'wage and hour violations', 'harassment', 'retaliation', 'non-compete disputes'],
    qualificationFactors: ['employment relationship established', 'documentation of issues', 'timeline of events clear', 'damages identifiable'],
    typicalConcerns: ['at-will employment', 'arbitration agreement', 'statute of limitations', 'independent contractor misclassification'],
    recommendedQualification: 'green',
  },

  construction_law: {
    name: 'Construction Law',
    rawTerms: ['Construction Law', 'Construction'],
    commonCases: ['construction defects', 'mechanic liens', 'contract disputes', 'delay claims', 'payment disputes'],
    qualificationFactors: ['contract exists', 'defects documented', 'notice requirements met', 'lien deadlines tracked'],
    typicalConcerns: ['lien deadline approaching', 'multiple contractors involved', 'insurance coverage unclear', 'project still ongoing'],
    recommendedQualification: 'green',
  },

  products_liability: {
    name: 'Products Liability',
    rawTerms: ['Products Liability'],
    commonCases: ['defective products', 'pharmaceutical injuries', 'medical device failures', 'vehicle defects', 'consumer product injuries'],
    qualificationFactors: ['product identified', 'injury documented', 'product preserved', 'purchase records available'],
    typicalConcerns: ['product modification', 'misuse defense', 'warnings adequate', 'causation complex'],
    recommendedQualification: 'green',
  },

  estate_planning: {
    name: 'Estate Planning',
    rawTerms: ['Probate Law', 'Estate Planning/Trusts', 'Wills & Probate', 'Estate Planning and Probate', 'Trusts and Estates', 'Trusts & Estates'],
    commonCases: ['will preparation', 'trust creation', 'probate administration', 'estate litigation', 'beneficiary disputes'],
    qualificationFactors: ['assets to protect', 'family situation clear', 'existing documents to review', 'goals identified'],
    typicalConcerns: ['blended family complexity', 'special needs beneficiaries', 'business succession issues', 'tax implications significant'],
    recommendedQualification: 'green',
  },

  business_corporate: {
    name: 'Business/Corporate',
    rawTerms: ['Corporate/Business', 'Business Law'],
    commonCases: ['business formation', 'contract drafting', 'partnership disputes', 'mergers and acquisitions', 'regulatory compliance'],
    qualificationFactors: ['business type identified', 'goals clear', 'stakeholders known', 'timeline reasonable'],
    typicalConcerns: ['existing litigation', 'regulatory issues', 'multi-state operations', 'intellectual property complications'],
    recommendedQualification: 'green',
  },

  social_security: {
    name: 'Social Security/Disability',
    rawTerms: ['Social Security'],
    commonCases: ['SSDI claims', 'SSI claims', 'disability appeals', 'overpayment disputes', 'benefits termination'],
    qualificationFactors: ['medical conditions documented', 'work history clear', 'application filed or ready', 'treating physician supportive'],
    typicalConcerns: ['substance abuse issues', 'non-compliance with treatment', 'prior denials', 'age and education factors'],
    recommendedQualification: 'yellow', // Often needs medical record review
  },

  toxic_torts: {
    name: 'Toxic Torts',
    rawTerms: ['Toxic Torts'],
    commonCases: ['asbestos exposure', 'chemical exposure', 'environmental contamination', 'water contamination', 'workplace toxins'],
    qualificationFactors: ['exposure documented', 'medical diagnosis confirmed', 'source identifiable', 'statute of limitations met'],
    typicalConcerns: ['latency period issues', 'multiple exposure sources', 'company bankruptcy', 'causation complex'],
    recommendedQualification: 'yellow',
  },

  tax_law: {
    name: 'Tax Law',
    rawTerms: ['Tax', 'Taxation'],
    commonCases: ['IRS audits', 'tax debt resolution', 'offer in compromise', 'innocent spouse relief', 'tax planning'],
    qualificationFactors: ['tax years identified', 'notices received documented', 'financial situation disclosed', 'compliance history known'],
    typicalConcerns: ['criminal tax exposure', 'unfiled returns', 'payroll tax issues', 'statute of limitations expiring'],
    recommendedQualification: 'green',
  },

  health_care_law: {
    name: 'Health Care Law',
    rawTerms: ['Health'],
    commonCases: ['provider compliance', 'licensing issues', 'HIPAA violations', 'Medicare/Medicaid audits', 'practice transactions'],
    qualificationFactors: ['provider type identified', 'regulatory issue clear', 'timeline known', 'documentation available'],
    typicalConcerns: ['ongoing investigation', 'multi-state licensing', 'corporate practice of medicine', 'fraud allegations'],
    recommendedQualification: 'yellow',
  },

  legal_malpractice: {
    name: 'Legal Malpractice',
    rawTerms: ['Legal Malpractice'],
    commonCases: ['missed deadlines', 'settlement without consent', 'conflict of interest', 'inadequate representation', 'billing disputes'],
    qualificationFactors: ['attorney-client relationship existed', 'breach identifiable', 'underlying case had merit', 'damages quantifiable'],
    typicalConcerns: ['case within a case complexity', 'statute of limitations', 'collectibility of judgment', 'expert testimony required'],
    recommendedQualification: 'yellow',
  },

  professional_liability: {
    name: 'Professional Liability',
    rawTerms: ['Professional Liability'],
    commonCases: ['accountant malpractice', 'architect errors', 'engineer negligence', 'financial advisor misconduct', 'real estate agent errors'],
    qualificationFactors: ['professional relationship established', 'standard of care breach clear', 'damages documented', 'causation direct'],
    typicalConcerns: ['expert testimony needed', 'contributory negligence', 'contract limitations', 'insurance coverage limits'],
    recommendedQualification: 'yellow',
  },
};

/**
 * Generate a sample intake for a specific practice area
 */
async function generateSampleIntake(areaKey, areaConfig) {
  console.log(`\nGenerating sample for: ${areaConfig.name}...`);

  const prompt = `You are generating a realistic sample intake report for a law firm intake screening system. The practice area is ${areaConfig.name}.

Generate a complete sample intake with the following structure:

1. **Contact Name**: A realistic first and last name
2. **Qualification**: ${areaConfig.recommendedQualification === 'green' ? 'QUALIFIED — High Confidence' : areaConfig.recommendedQualification === 'yellow' ? 'NEEDS REVIEW — Moderate Confidence' : 'NOT A FIT'}
3. **Case Summary**: 2-3 sentences describing the case facts (be specific with dates, injuries/issues, and relevant details)
4. **Positive Factors**: 2-4 factors that support taking this case (based on: ${areaConfig.qualificationFactors.join(', ')})
5. **Concerns**: 0-2 concerns to investigate (based on: ${areaConfig.typicalConcerns.join(', ')})
6. **Recommended Action**: A specific next step for the law firm
7. **Full Conversation Transcript**: 12-18 exchanges between "Intake" (the AI) and "Visitor" (the potential client)

The conversation should:
- Start with a welcome message and name collection
- Collect phone and email
- Ask about their ${areaConfig.name.toLowerCase()} matter
- Gather specific facts that support the case summary
- Include details that justify EACH positive factor listed
- Naturally surface any concerns mentioned
- End with confirmation of next steps

Common case types in this area: ${areaConfig.commonCases.join(', ')}

Return your response as valid JSON in this exact format:
{
  "contactName": "First Last",
  "qualification": "${areaConfig.recommendedQualification}",
  "confidenceLevel": "${areaConfig.recommendedQualification === 'green' ? 'High Confidence' : areaConfig.recommendedQualification === 'yellow' ? 'Moderate Confidence' : 'Low Confidence'}",
  "caseType": "${areaConfig.name}",
  "summary": "2-3 sentence case summary...",
  "positiveFactors": ["Factor 1", "Factor 2", "Factor 3"],
  "concerns": ["Concern 1"] or [],
  "recommendedAction": "Specific next step...",
  "transcript": [
    {"speaker": "intake", "text": "Welcome message..."},
    {"speaker": "visitor", "text": "Response..."},
    ...
  ]
}

Make the scenario realistic and specific to ${areaConfig.name}. The transcript should feel like a natural conversation, not a form interrogation. Include specific dates (use "3 weeks ago", "last month", "in January" style references), names of doctors/facilities/companies where relevant, and concrete details.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract the JSON from the response
    const content = response.content[0].text;

    // Try to parse the JSON (handle potential markdown code blocks)
    let jsonStr = content;
    if (content.includes('```json')) {
      jsonStr = content.split('```json')[1].split('```')[0].trim();
    } else if (content.includes('```')) {
      jsonStr = content.split('```')[1].split('```')[0].trim();
    }

    const sample = JSON.parse(jsonStr);
    console.log(`  ✓ Generated: ${sample.contactName} - ${sample.qualification}`);
    return sample;

  } catch (error) {
    console.error(`  ✗ Error generating ${areaConfig.name}:`, error.message);
    return null;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('='.repeat(70));
  console.log('Sample Intake Generator for PreIntake.ai');
  console.log('='.repeat(70));

  // List mode
  if (LIST_ONLY) {
    console.log('\nAvailable Practice Areas:\n');
    Object.entries(PRACTICE_AREAS).forEach(([key, config], index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${key.padEnd(25)} → ${config.name}`);
      console.log(`    Raw terms: ${config.rawTerms.join(', ')}`);
    });
    console.log(`\nTotal: ${Object.keys(PRACTICE_AREAS).length} practice areas`);
    process.exit(0);
  }

  // Determine which areas to generate
  let areasToGenerate = Object.entries(PRACTICE_AREAS);

  if (SPECIFIC_AREA) {
    if (!PRACTICE_AREAS[SPECIFIC_AREA]) {
      console.error(`\nError: Unknown practice area "${SPECIFIC_AREA}"`);
      console.log('Use --list to see available practice areas');
      process.exit(1);
    }
    areasToGenerate = [[SPECIFIC_AREA, PRACTICE_AREAS[SPECIFIC_AREA]]];
  }

  console.log(`\nMode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Areas to generate: ${areasToGenerate.length}`);

  if (DRY_RUN) {
    console.log('\nWould generate samples for:');
    areasToGenerate.forEach(([key, config]) => {
      console.log(`  - ${config.name} (${key})`);
    });
    process.exit(0);
  }

  // Load existing samples if doing a partial generation
  const outputPath = path.join(__dirname, '../preintake/data/sample-intakes.json');
  let existingSamples = {};

  if (SPECIFIC_AREA && fs.existsSync(outputPath)) {
    try {
      existingSamples = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      console.log(`\nLoaded ${Object.keys(existingSamples).length} existing samples`);
    } catch (e) {
      console.log('\nNo existing samples found or error reading file');
    }
  }

  // Generate samples
  const samples = { ...existingSamples };
  let successCount = 0;
  let errorCount = 0;

  for (const [key, config] of areasToGenerate) {
    const sample = await generateSampleIntake(key, config);
    if (sample) {
      samples[key] = sample;
      successCount++;
    } else {
      errorCount++;
    }

    // Small delay between API calls
    if (areasToGenerate.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write output
  fs.writeFileSync(outputPath, JSON.stringify(samples, null, 2));

  console.log('\n' + '='.repeat(70));
  console.log('Summary:');
  console.log(`  Generated: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  Output: ${outputPath}`);
  console.log('='.repeat(70));
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
