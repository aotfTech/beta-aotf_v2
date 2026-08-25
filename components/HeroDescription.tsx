import { Button } from "@heroui/button";
import { ArrowRight, MailQuestionMark } from "lucide-react";
import TextType from "./reactbits/ui/TextType";
import Redirect from "./Redirect";
import { EnquiryIcon } from "./icons";

const HeroDescription = () => {
  return (
    <section className="w-full my-5 md:my-10 flex flex-col lg:flex-row gap-5 max-md:gap-10 items-left justify-between">
      <div className="flex flex-col md:flex-col md:items-start justify-between px-4">
        {/* <div className="flex flex-wrap items-center justify-center p-1.5 rounded-full border border-slate-400 text-gray-500 text-xs">
          <div className="flex items-center">
            <img
              className="size-7 rounded-full border-3 border-white"
              src="https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=50"
              alt="userImage1"
            />
            <img
              className="size-7 rounded-full border-3 border-white -translate-x-2"
              src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=50"
              alt="userImage2"
            />
            <img
              className="size-7 rounded-full border-3 border-white -translate-x-4"
              src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=50&h=50&auto=format&fit=crop"
              alt="userImage3"
            />
          </div>
          <p className="-translate-x-2">Join community of 1m+ founders </p>
        </div> */}
        <h1 className="font-semibold md:text-left text-3xl md:text-5xl md:leading-15 max-w-xl leading-10">
          Find Trusted
          <br />
          <TextType
            text={["Tutors", "Freelancers", "Career Opportunities"]}
            typingSpeed={75}
            pauseDuration={1500}
            showCursor={true}
            cursorCharacter="_"
            className="inline-block text-3xl md:text-5xl font-semibold text-[#ff9f51]"
          />
          {/* <span className="text-[#ff9f51]"> Quality Educators </span>
          <span className="text-[#ff9f51]">Skilled Professionals</span>  */}
          <br />
          <span className="bg-[#72b18c] text-white text-2xl"> All in One Place</span>
        </h1>
        <p className="md:text-left text-lg max-w-lg mt-2">
          AOTF connects students, guardians, educators, freelancers, and clients through verified opportunities, personalized guidance, and reliable support across India.
        </p>
        <div className="flex items-center justify-center gap-4 mt-4 text-sm">
          <Redirect to="/enquiry">
            <Button
              radius="full"
              className="relative overflow-hidden flex items-center gap-2 px-7 py-2.5
    text-white font-semibold tracking-wide

    bg-linear-to-r from-indigo-600 via-purple-600 to-pink-500
    shadow-lg shadow-purple-500/30

    hover:shadow-pink-500/40 hover:-translate-y-1
    active:scale-95 transition-all duration-300

    before:absolute before:inset-0 before:rounded-full
    before:bg-linear-to-r before:from-white/20 before:to-transparent
    before:opacity-0 hover:before:opacity-100 before:transition

    group"
            >
              {/* Shine effect */}
              <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-500">
                <span
                  className="absolute -left-full top-0 h-full w-1/2 
      bg-linear-to-r from-transparent via-white/40 to-transparent 
      skew-x-12 animate-[shine_1.2s_ease]"
                />
              </span>

              <MailQuestionMark className="w-5 h-5 group-hover:rotate-6 transition" />

              <span>Make an Enquiry</span>
            </Button>
          </Redirect>
          {/* <Button className="flex items-center gap-2 border transition rounded-md px-6">
            <span>Watch demo</span>
          </Button> */}
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <img
          src="https://res.cloudinary.com/dzko1daqg/image/upload/v1786900681/ChatGPT_Image_Aug_16_2026_10_45_23_PM_lh0jzx.png"
          alt="hero"
          className="h-95 w-auto transition-all duration-300 hover:scale-102 rounded-xl"
        />
      </div>
    </section>
  );
};

export default HeroDescription;
