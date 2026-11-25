import { Header } from "@/components/Header";
import { getViewer } from "@/lib/auth";
import { KEEP_MONTHS } from "@/lib/release";

export default async function Privacy() {
  const v = await getViewer();
  return (
    <>
      <Header viewer={v} />
      <main className="band"><div className="narrow panel">
        <h1>How your information is used</h1>
        <p>Your golf club runs pace-of-play ratings and decides how they&apos;re used. The club is the data controller. Pace of Play Ratings provides the service for the club and only handles your information on its instructions.</p>
        <h3>What we hold</h3>
        <p>Your name, member number, handicap, email and mobile number, as supplied by the club. Who you played with and when, from the club&apos;s tee sheet. The star ratings and notes members give each other.</p>
        <h3>Why</h3>
        <p>To ask you to rate your playing partners&apos; pace after a round, and to show members a monthly pace score so the course flows better for everyone.</p>
        <h3>Who sees what</h3>
        <ul>
          <li>Members see each other&apos;s released monthly scores, once a member has at least 5 ratings. Nobody sees individual ratings or who gave them.</li>
          <li>Club secretaries see low ratings (1 or 2 stars), the reason given and who gave it, so they can check it&apos;s fair before it counts.</li>
          <li>Texts and emails are sent through Twilio and Resend. Data is stored with Supabase. These providers act for us under data processing agreements.</li>
        </ul>
        <h3>How long</h3>
        <p>Rounds and ratings are deleted automatically after {KEEP_MONTHS} months.</p>
        <h3>Your choices</h3>
        <p>Every message has a link to stop rating messages. To see, correct or delete your information, contact your club secretary, who can remove you and every rating linked to you.</p>
      </div></main>
    </>
  );
}
