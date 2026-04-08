import { Accordion, AccordionTab } from 'primereact/accordion';
import type { WebsiteHealthSiteResult } from '@/types';
import styles from './WebsiteHealthDashboard.module.scss';

interface WebsiteHealthInfoHelpProps {
  site: WebsiteHealthSiteResult;
}

export function WebsiteHealthInfoHelp({ site }: WebsiteHealthInfoHelpProps) {
  const webDbProblem =
    site.webDbStatus === 'error'
      ? `ERROR: ${site.webDbIssueCount.toLocaleString()} website row(s) fail a Web DB consistency rule below. The issue list shows every applicable reason per row; breakdown counts can overlap. This is separate from 2K16 matching.`
      : 'OK: no candidate rows violate the Web DB consistency rules.';

  const compareProblem =
    site.status === 'warning'
      ? `WARNING means some submissions that have a confirmation number were not found in CleanClaims under the online filter — often a downloader timing gap or sync issue worth investigating.`
      : site.status === 'error'
        ? `ERROR here means the scan could not finish (database offline, missing table, etc.). Use any error text above if shown.`
        : `OK means every in-scope submission with a confirmation number matched an online CleanClaims row with the same confirmation.`;

  return (
    <div className={styles.infoHelpAccordion}>
      <Accordion multiple>
        <AccordionTab header="What does Web DB status mean?">
          <div className={styles.infoHelpBody}>
            <p>
              <strong>Web DB</strong> checks consistency on website <code>Submissions</code> rows. Rules are:
            </p>
            <ul>
              <li>
                If <strong>DateReceived is present</strong> (submitted-style row), confirmation must be present.
              </li>
              <li>
                If <strong>DateReceived is present</strong>, <strong>IsSubmitted</strong> must be effectively{' '}
                <code>1</code> / true when a submitted-flag column exists.
              </li>
              <li>
                If <strong>DateReceived is missing</strong> but confirmation exists, that mismatch is an issue.
              </li>
            </ul>
            <p>
              <strong>Expected drafts are not errors:</strong> rows with no <code>DateReceived</code> and no confirmation
              are allowed (for example unsubmitted records). A single row can still be wrong in multiple ways when the
              submitted-style conditions are met. If the website schema has no submitted-flag column (
              <code>IsSubmitted</code>, <code>IsSubmittedOnline</code>, etc.), the IsSubmitted rule is skipped so we do
              not flag every row.
            </p>
            <ul>
              <li>
                <strong>OK</strong> — No candidate rows fail any of the three checks.
              </li>
              <li>
                <strong>ERROR</strong> — At least one row fails one or more checks. These rows are not used as
                “missing in CleanClaims” for the confirmation compare when confirmation is absent.
              </li>
            </ul>
            <p className={styles.infoHelpHighlight}>{webDbProblem}</p>
            <p>
              <strong>Candidate rows</strong> use the same filters as the scanner (test IDs, email, deadline, 5:15 rule
              for today, etc.) but can include <code>DateReceived IS NULL</code> so incomplete submissions appear in the
              Web DB issue list.
            </p>
          </div>
        </AccordionTab>
        <AccordionTab header="What does Status (comparison) mean?">
          <div className={styles.infoHelpBody}>
            <p>
              <strong>Status</strong> is the <strong>website vs 2K16 CleanClaims</strong> result using confirmation
              numbers.
            </p>
            <ul>
              <li>
                <strong>OK</strong> — No confirmation mismatches: every in-scope submission with a confirmation appears
                in online CleanClaims with that confirmation.
              </li>
              <li>
                <strong>WARNING</strong> — One or more confirmations from the website are missing from online CleanClaims
                rows (after filters). Often downloader delay, cutoff timing, or real gaps.
              </li>
              <li>
                <strong>ERROR</strong> — The comparison could not run to completion for this case.
              </li>
            </ul>
            <p className={styles.infoHelpHighlight}>{compareProblem}</p>
          </div>
        </AccordionTab>
        <AccordionTab header="What do Submitted, Matched, and Missing mean?">
          <div className={styles.infoHelpBody}>
            <ul>
              <li>
                <strong>Submitted</strong> — Rows in <code>Submissions</code> that pass the <strong>strict</strong> compare
                filters, including <code>DateReceived IS NOT NULL</code>.
              </li>
              <li>
                <strong>Matched</strong> — Of those, how many had a confirmation that appears in online CleanClaims.
              </li>
              <li>
                <strong>Missing</strong> — Submissions that <em>have</em> a confirmation number but that confirmation was
                not found on matching online CleanClaims rows. Web DB integrity is a separate concept.
              </li>
            </ul>
          </div>
        </AccordionTab>
        <AccordionTab header="Filters and compare method">
          <div className={styles.infoHelpBody}>
            <ul>
              <li>
                <strong>Match key</strong> — Normalized confirmation number (trim + lowercase) on website vs CleanClaims.
              </li>
              <li>
                <strong>Today</strong> — Only submissions through <strong>5:15 AM</strong> on the current day are
                included; later same-day rows wait for the next downloader window.
              </li>
              <li>
                <strong>Test IDs</strong> — Submission IDs <code>2000000–2000039</code> are excluded.
              </li>
              <li>
                <strong>Email</strong> — Rows with <code>@cptgroup.com</code> are excluded (internal test traffic).
              </li>
              <li>
                <strong>Deadline</strong> — When set on the case, <code>DateReceived</code> must be on or before the
                deadline date (when DateReceived is present).
              </li>
              <li>
                <strong>CleanClaims</strong> — Only rows treated as filed/submitted online (e.g. <code>ClaimFiledOnline</code>
                ) are used on the 2K16 side.
              </li>
            </ul>
          </div>
        </AccordionTab>
      </Accordion>
    </div>
  );
}
