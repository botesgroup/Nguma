import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Logout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      try {
        await supabase.auth.signOut();
      } finally {
        navigate("/auth", { replace: true });
      }
    };
    run();
  }, [navigate]);

  return null;
};

export default Logout;


