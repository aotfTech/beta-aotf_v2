import { Button } from "@heroui/button";
import Underline from "./ui/Underline";
import Redirect from "./Redirect";

export default function OurServices() {
  return (
    <>
      <section className="flex flex-col md:flex-row items-center justify-center gap-10 my-5 md:my-10">
        <div className="relative shadow-2xl shadow-indigo-600/40 rounded-2xl overflow-hidden shrink-0">
          <img
            className="max-w-md w-full object-cover rounded-2xl"
            src="./our_services.png"
            alt=""
          />
        </div>
        <div className="text-md max-w-lg px-4">
          <Underline title="Our Services" size="large" className="mb-4" />
          <p className="mt-8">
            AOTF bridges the gap between trusted educators, skilled
            professionals, and those who need them. We provide a structured,
            reliable platform to connect guardians with qualified teachers and
            clients with verified freelancers across India.{" "}
          </p>
          <p className="mt-4">
            From 1:1 personalized tutoring and batch tuition (online or at home)
            to freelance and job-based talent hiring, AOTF ensures quality
            matching, transparent processes, and dependable support at every
            step.
          </p>
          <p className="mt-4">
            Whether you are looking to learn, teach, hire, or work, AOTF makes
            the connection simple, secure, and scalable.
          </p>
          {/* <Redirect to="/services">
            <Button className="flex items-center w-max gap-2 mt-8 hover:-translate-y-0.5 transition bg-linear-to-r from-indigo-600 to-[#8A7DFF] py-3 px-8 rounded-full text-white">
              <span>Read more</span>
              <svg
                width="13"
                height="12"
                viewBox="0 0 13 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12.53 6.53a.75.75 0 0 0 0-1.06L7.757.697a.75.75 0 1 0-1.06 1.06L10.939 6l-4.242 4.243a.75.75 0 0 0 1.06 1.06zM0 6v.75h12v-1.5H0z"
                  fill="#fff"
                />
              </svg>
            </Button>
          </Redirect> */}
        </div>
      </section>
    </>
  );
}
