import Button from "../../components/ui/Button";
import Container from "../../components/ui/container";
import Logo from "../../components/ui/Logo";

export default function Navbar() {

    return (
        <>
            <header className="border-b border-zinc-900">
                <Container>
                    <nav className="h-20 flex items-center justify-between">
                        <Logo />
                        <div className="hidden md:flex items-center gap-8 text-zinc-400">
                            <a href="#">Product</a>
                            <a href="#">Features</a>
                            <a href="#">Templates</a>
                            <a href="#">Pricing</a>
                        </div>

                        <div className="flex items-center gap-3">
                            <button className="text-zinc-300">
                                Login
                            </button>

                            <Button>
                                Get Started
                            </Button>
                        </div>
                    </nav>
                </Container>
            </header>
        </>
    )
}