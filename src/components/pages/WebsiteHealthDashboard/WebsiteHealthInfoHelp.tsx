import { Accordion, AccordionTab } from 'primereact/accordion';
import type { WebsiteHealthSiteResult } from '@/types';
import styles from './WebsiteHealthDashboard.module.scss';

interface WebsiteHealthInfoHelpProps {
  site: WebsiteHealthSiteResult;
}

export function WebsiteHealthInfoHelp({ site }: WebsiteHealthInfoHelpProps) {
  const webDbProblem =
    site.webDbStatus === 'error'
      ? `This row shows ERROR because at least one in-scope website submission is missing a confirmation number and/or is not marked submitted online (${site.webDbIssueCount.toLocaleString()} row(s) affected). That is separate from whether 2K16 has a matching claim.`
      : 'OK means every in-scope row has a confirmation number and is not explicitly marked “not submitted” on the website (when that column exists).';

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
              <strong>Web DB</strong> checks the website <code>Submissions</code> table only — before we compare to 2K16.
            </p>
            <ul>
              <li>
                <strong>OK</strong> — In-scope rows have a confirmation number and are not flagged as not submitted when
                the site has a submitted flag column (for example <code>IsSubmitted</code> or <code>IsSubmittedOnline</code>
                ).
              </li>
              <li>
                <strong>ERROR</strong> — At least one in-scope row is missing a confirmation number, or the submitted flag
                is explicitly false. Fix these on the website side; they are not counted as “missing in CleanClaims” for
                the confirmation compare.
              </li>
            </ul>
            <p className={styles.infoHelpHighlight}>{webDbProblem}</p>
            <p>
              <strong>Missing confirmation</strong> — <code>DateReceived</code> is set but confirmation is blank.
              <br />
              <strong>Not submitted</strong> — Row is in scope but the site marks it as not submitted online.
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
                <strong>Submitted</strong> — Rows in <code>Submissions</code> that pass all source filters (date received,
                5:15 AM rule for today, test ID range, email, deadline, etc.).
              </li>
              <li>
                <strong>Matched</strong> — Of those, how many had a confirmation that appears in online CleanClaims.
              </li>
              <li>
                <strong>Missing</strong> — Submissions that <em>have</em> a confirmation number but that confirmation was
                not found on matching online CleanClaims rows. Blank confirmations are tracked under Web DB status, not
                here.
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
                deadline date.
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
