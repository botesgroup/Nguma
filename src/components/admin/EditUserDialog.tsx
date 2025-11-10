
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateUserProfile } from "@/services/adminService";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

// We need to pass the full investor object to pre-fill the form
type Investor = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  post_nom: string | null;
  email: string;
  phone: string | null;
};

interface EditUserDialogProps {
  user: Investor;
}

export const EditUserDialog = ({ user }: EditUserDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    postNom: '',
    phone: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        postNom: user.post_nom || '',
        phone: user.phone || '',
      });
    }
  }, [user]);

  const mutation = useMutation({
    mutationFn: updateUserProfile,
    onSuccess: () => {
      toast({ title: "Succès", description: "Le profil de l'utilisateur a été mis à jour." });
      queryClient.invalidateQueries({ queryKey: ["investorsList"] });
      queryClient.invalidateQueries({ queryKey: ["userDetails", user.id] });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmit = () => {
    mutation.mutate({
      userId: user.id,
      ...formData,
    });
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Modifier le profil de {user.email}</DialogTitle>
        <DialogDescription>
          Mettez à jour les informations du profil de l'utilisateur.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">Prénom</Label>
          <Input id="firstName" value={formData.firstName} onChange={handleInputChange} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Nom</Label>
          <Input id="lastName" value={formData.lastName} onChange={handleInputChange} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="postNom">Post-nom</Label>
          <Input id="postNom" value={formData.postNom} onChange={handleInputChange} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Téléphone</Label>
          <Input id="phone" value={formData.phone} onChange={handleInputChange} />
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Annuler</Button>
        </DialogClose>
        <Button onClick={handleSubmit} disabled={mutation.isPending}>
          {mutation.isPending ? "Enregistrement..." : "Enregistrer les modifications"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};
