import BackButton from "@/components/BackButton";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { MailIcon, MapPinIcon, PhoneIcon } from "lucide-react";

export default function DocsPage() {
  return (
    <div>
      <BackButton title="Contact Us" />
      <div className="container mx-auto px-4 pb-20 ">
        <section className="mt-5 w-full bg-gray-100 dark:bg-gray-800 rounded-2xl">
          <div className="container px-4 py-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-12">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">Get in touch</h2>
                  <p className="max-w-150 text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                    Whether you’re looking for a tutor, a freelancer, or want to join our growing network, we’d love to hear from you.
                  </p>
                  <p className="max-w-150 text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                    Whether someone is searching for the right tutor, trying to build a freelance career, or looking for reliable academic support, the process often feels confusing and unorganized.
                  </p>
                  <p className="max-w-150 text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                    AOTF aims to bridge that gap by creating a trusted platform where learning, mentorship, and opportunities come together.
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">Contact Information</h2>
                  <p className="text-gray-500 dark:text-gray-400">
                    Get in touch with us using the information below.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <MapPinIcon className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                    <div>
                      <p className="font-medium">Office Address</p>
                      <p className="text-gray-500 dark:text-gray-400">
                        11 No. Dulal Nagar, Belgharia, Kolkata – 700056 <br />
                        Near Alap Banquet
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <PhoneIcon className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                    <div>
                      <p className="font-medium">Phone</p>
                      <p className="text-gray-500 dark:text-gray-400">
                        6290338214 (WhatsApp & Call)
                      </p>
                    </div>
                  </div>
                  <a href="mailto:contact@aotf.in" className="block">
                    <div className="flex items-start gap-2 cursor-pointer">
                      <MailIcon className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                      <div>
                        <p className="font-medium">Email</p>
                        <p className="text-gray-500 dark:text-gray-400">
                          contact@aotf.in
                        </p>
                      </div>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
