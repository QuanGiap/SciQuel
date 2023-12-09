import { ContactForm } from "@/components/ContactForm/ContactForm";

export default function feedbackPage() {
  return (
    <div className="m-auto mb-8 mt-10 flex w-full flex-1 flex-col items-center px-4 sm:mt-8 md:w-[768px]">
      <h1 className="mb-8 w-full text-center text-4xl font-bold text-sciquelTeal  sm:mb-6 sm:text-5xl">
        Leave Feedback
      </h1>
      <div className="mb-12 flex w-full sm:mb-16">
        <h2 className="w-max px-2 text-2xl font-bold text-[#046969] sm:text-3xl">
          Contact Us
        </h2>
        <p className="flex-1 px-2 sm:text-xl md:text-2xl">
          Want to read about a certain topic? Found an error? Have a question?
          We value your thoughts.
        </p>
      </div>

      <ContactForm endpoint="" />
    </div>
  );
}
