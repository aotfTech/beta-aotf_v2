"use client";
import {
  Navbar as HeroUINavbar,
  NavbarContent,
  NavbarBrand,
  NavbarItem,
} from "@heroui/navbar";
import { Button } from "@heroui/button";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useUser, useClerk, SignedIn, SignedOut } from "@clerk/nextjs";
import { ThemeSwitch } from "@/components/theme-switch";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/dropdown";
import { Avatar } from "@heroui/avatar";
import { FaUserAlt } from "react-icons/fa";
import { RiDashboardHorizontalFill } from "react-icons/ri";
import { RiLogoutBoxRLine } from "react-icons/ri";
import Image from "next/image";
import { MdFeedback } from "react-icons/md";
import Redirect from "./Redirect";

export const Navbar = () => {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  const username = user?.username ?? "";
  const isAdmin = (user as any)?.publicMetadata?.isAdmin === true;

  return (
    <HeroUINavbar maxWidth="xl" position="sticky" className="z-50 h-fit top-0">
      <NavbarContent className="h-fit ml-10" justify="start">
        <NavbarBrand as="li" className="gap-3 max-w-fit">
          <NextLink className="flex justify-start items-center gap-1" href="/">
            <Image src="/AOTF.svg" alt="Logo" width={50} height={50} />
          </NextLink>
        </NavbarBrand>
      </NavbarContent>

      <NavbarContent className="h-fit hidden md:flex" justify="center">
        <NavbarItem>
          <Redirect to="/">Home</Redirect>
        </NavbarItem>
        <NavbarItem>
          <Redirect to="/posts">Tuitions</Redirect>
        </NavbarItem>
        <NavbarItem>
          <Redirect to="/jobs">Jobs</Redirect>
        </NavbarItem>
        <NavbarItem>
          <Redirect to="/enquiry">Enquiry</Redirect>
        </NavbarItem>
      </NavbarContent>
      <NavbarContent className="flex h-fit" justify="end">
        <ThemeSwitch />
      </NavbarContent>

      <SignedIn>
        <NavbarContent justify="center" className="h-fit">
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Avatar
                isBordered
                size="sm"
                as="button"
                className="transition-transform"
                src={user?.imageUrl}
                name={user?.firstName?.[0] ?? ""}
              />
            </DropdownTrigger>
            <DropdownMenu aria-label="Profile Actions" variant="flat">
              <DropdownItem key="email" className="gap-2" textValue="email">
                <p className="font-semibold">
                  {user?.primaryEmailAddress?.emailAddress}
                </p>
              </DropdownItem>

              {isAdmin ? (
                <>
                  <DropdownItem
                    key="admin-dashboard"
                    textValue="Admin Dashboard"
                    onPress={() => router.push(`/admin/agenda-view`)}
                  >
                    <div className="flex items-center gap-2">
                      <RiDashboardHorizontalFill className="text-default-500" />
                      <p className="font-semibold">Updates</p>
                    </div>
                  </DropdownItem>
                  <DropdownItem
                    key="admin-users"
                    textValue="Admin Users"
                    onPress={() => router.push(`/admin/tuitions`)}
                  >
                    <div className="flex items-center gap-2">
                      <FaUserAlt className="text-default-500" />
                      <p className="font-semibold">Tuitions</p>
                    </div>
                  </DropdownItem>
                  <DropdownItem
                    key="admin-settings"
                    textValue="Admin Settings"
                    onPress={() => router.push(`/admin/jobs`)}
                  >
                    <div className="flex items-center gap-2">
                      <MdFeedback className="text-default-500" />
                      <p className="font-semibold">Jobs</p>
                    </div>
                  </DropdownItem>
                </>
              ) : (
                <>
                  <DropdownItem
                    key="profile"
                    textValue="Profile"
                    onPress={() => router.push(`/u/${username}`)}
                  >
                    <div className="flex items-center gap-2">
                      <FaUserAlt className="text-default-500" />
                      <p className="font-semibold">Profile</p>
                    </div>
                  </DropdownItem>
                  <DropdownItem
                    key="dashboard"
                    textValue="Dashboard"
                    onPress={() => router.push(`/u/${username}/dashboard`)}
                  >
                    <div className="flex items-center gap-2">
                      <RiDashboardHorizontalFill className="text-default-500" />
                      <p className="font-semibold">Dashboard</p>
                    </div>
                  </DropdownItem>
                  <DropdownItem
                    key="feedback"
                    textValue="Feedback"
                    onPress={() => router.push(`/u/${username}/feedback`)}
                  >
                    <div className="flex items-center gap-2">
                      <MdFeedback className="text-default-500" />
                      <p className="font-semibold">Feedback</p>
                    </div>
                  </DropdownItem>
                </>
              )}
              <DropdownItem
                key="logout"
                color="danger"
                textValue="Log Out"
                className="text-danger bg-danger/10 hover:bg-danger/20"
                onPress={() => signOut({ redirectUrl: "/" })}
              >
                <div className="flex items-center gap-2">
                  <RiLogoutBoxRLine className="text-danger" />
                  <p className="font-semibold">Log Out</p>
                </div>
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </NavbarContent>
      </SignedIn>

      <SignedOut>
        <NavbarContent justify="center" className="gap-4 h-fit">
          <Button
            variant="shadow"
            color="primary"
            onPress={() => router.push("/sign-in")}
          >
            Log In / Register
          </Button>
        </NavbarContent>
      </SignedOut>
    </HeroUINavbar>
  );
};
