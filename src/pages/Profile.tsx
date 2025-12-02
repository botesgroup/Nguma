import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProfile, updateProfile } from '@/services/profileService';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, set } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COUNTRIES, getCitiesByCountry, getCountryDialCode } from '@/lib/countries';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { uploadAvatar } from '@/services/avatarService';
import { PasswordUpdateCard } from '@/components/PasswordUpdateCard';

const profileSchema = z.object({
  email: z.string().email().optional(),
  first_name: z.string().min(2, { message: "Le prénom est requis." }),
  last_name: z.string().min(2, { message: "Le nom est requis." }),
  post_nom: z.string().optional(), // Post-nom optionnel
  phone: z.string()
    .min(10, { message: "Le numéro de téléphone doit contenir au moins 10 chiffres." })
    .regex(
      /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/,
      { message: "Format de téléphone invalide. Ex: +243 123 456 789" }
    ),
  country: z.string().length(2, { message: "Veuillez sélectionner un pays." }), // Code ISO
  city: z.string().min(2, { message: "La ville est requise." }),
  address: z.string().min(5, { message: "L'adresse est requise." }),
  birth_date: z.date({ required_error: "La date de naissance est requise." }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const ProfilePage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [wasProfileIncomplete, setWasProfileIncomplete] = useState(false);

  // Avatar states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      email: '',
      first_name: '',
      last_name: '',
      post_nom: '',
      phone: '',
      country: '',
      city: '',
      address: '',
    },
  });

  // Surveiller le pays sélectionné pour mettre à jour les villes
  const selectedCountry = form.watch('country');

  useEffect(() => {
    if (profile) {
      form.reset({
        email: profile.email || '',
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        post_nom: profile.post_nom || '',
        phone: profile.phone || '',
        country: profile.country || '',
        city: profile.city || '',
        address: profile.address || '',
        birth_date: profile.birth_date ? new Date(profile.birth_date) : undefined,
      });

      const isProfileIncomplete = (
        !profile.first_name || profile.first_name.trim() === '' ||
        !profile.last_name || profile.last_name.trim() === '' ||
        // post_nom maintenant optionnel
        !profile.phone || profile.phone.trim() === '' ||
        !profile.country || profile.country.trim() === '' ||
        !profile.city || profile.city.trim() === '' || // Nouveau champ
        !profile.address || profile.address.trim() === '' ||
        !profile.birth_date
      );
      if (isProfileIncomplete) {
        setIsAlertOpen(true);
        setWasProfileIncomplete(true); // Marquer que le profil était incomplet
      }
    }
  }, [profile, form]);

  // Réinitialiser la ville quand le pays change
  useEffect(() => {
    if (selectedCountry) {
      // Si le pays change et que la ville actuelle n'est pas dans la nouvelle liste
      const cities = getCitiesByCountry(selectedCountry);
      const currentCity = form.getValues('city');
      if (currentCity && !cities.includes(currentCity)) {
        form.setValue('city', ''); // Réinitialiser la ville
      }
    }
  }, [selectedCountry, form]);

  const mutation = useMutation({
    mutationFn: (values: ProfileFormValues) => {
      const dataToUpdate = {
        ...values,
        birth_date: values.birth_date ? format(values.birth_date, 'yyyy-MM-dd') : undefined,
      };
      return updateProfile(dataToUpdate);
    },
    onSuccess: (updatedProfile) => {
      // Vérifier si le profil est maintenant complet
      const isNowComplete =
        updatedProfile.first_name && updatedProfile.first_name.trim() !== '' &&
        updatedProfile.last_name && updatedProfile.last_name.trim() !== '' &&
        updatedProfile.phone && updatedProfile.phone.trim() !== '' &&
        updatedProfile.country && updatedProfile.country.trim() !== '' &&
        updatedProfile.city && updatedProfile.city.trim() !== '' &&
        updatedProfile.address && updatedProfile.address.trim() !== '' &&
        updatedProfile.birth_date;

      queryClient.setQueryData(['profile'], updatedProfile);
      queryClient.invalidateQueries({ queryKey: ['profile'] });


      // Si le profil était incomplet et est maintenant complet, rediriger
      if (wasProfileIncomplete && isNowComplete) {
        toast({
          title: "Profil complété !",
          description: "Redirection vers votre tableau de bord..."
        });
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500); // Délai de 1.5s pour laisser voir le message
      } else {
        toast({ title: "Succès", description: "Votre profil a été mis à jour." });
      }
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    },
  });

  const onSubmit = (values: ProfileFormValues) => {
    mutation.mutate(values);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validation simple du type de fichier
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        toast({ variant: "destructive", title: "Erreur", description: "Type de fichier non autorisé. Uniquement PNG, JPG, WEBP." });
        return;
      }
      // Validation de la taille
      if (file.size > 5 * 1024 * 1024) { // 5MB
        toast({ variant: "destructive", title: "Erreur", description: "Fichier trop volumineux. La taille maximale est de 5Mo." });
        return;
      }

      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleUploadClick = async () => {
    if (!selectedFile || !profile) return;

    setIsUploading(true);
    try {
      await uploadAvatar(selectedFile, profile.id);
      toast({ title: "Succès", description: "Votre photo de profil a été mise à jour." });
      setSelectedFile(null);
      setPreview(null);
      // Invalider la query du profil pour rafraîchir l'avatar partout
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    } finally {
      setIsUploading(false);
    }
  };


  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Mon Profil</h1>
        <p className="text-muted-foreground">Mettez à jour vos informations personnelles et votre photo.</p>
      </div>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Action requise : Profil incomplet !</AlertDialogTitle>
            <AlertDialogDescription>
              Pour des raisons de sécurité et pour accéder à toutes les fonctionnalités, veuillez compléter toutes les informations de votre profil ci-dessous.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Compris</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Photo de Profil</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={preview || profile?.avatar_url || ''} alt="User avatar" />
              <AvatarFallback>
                {profile?.first_name?.[0]?.toUpperCase()}
                {profile?.last_name?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/png, image/jpeg, image/webp"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                variant="outline"
              >
                Changer la photo
              </Button>
              {preview && selectedFile && (
                <Button onClick={handleUploadClick} disabled={isUploading}>
                  {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sauvegarder la photo
                </Button>
              )}
              <p className="text-sm text-muted-foreground">PNG, JPG ou WEBP. 5Mo maximum.</p>
            </div>
          </div>
        </CardContent>
      </Card>


      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Informations du Profil</CardTitle>
          <CardDescription>Ces informations nous aident à mieux vous connaître.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-6">
                <Skeleton className="h-24 w-24 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              <Skeleton className="h-10 w-32 mt-4" />
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} disabled />
                    </FormControl>
                    <p className="text-sm text-muted-foreground pt-2">L'adresse email ne peut pas être modifiée.</p>
                    <FormMessage />
                  </FormItem>
                )} />                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">                  <FormField control={form.control} name="first_name" render={({ field }) => (
                  <FormItem><FormLabel>Prénom</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                  <FormField control={form.control} name="last_name" render={({ field }) => (
                    <FormItem><FormLabel>Nom</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="post_nom" render={({ field }) => (
                  <FormItem><FormLabel>Post-nom</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="birth_date" render={({ field }) => {
                  const [month, setMonth] = useState(field.value ?? new Date());

                  useEffect(() => {
                    if (field.value) {
                      setMonth(field.value);
                    }
                  }, [field.value]);

                  return (
                    <FormItem className="flex flex-col"><FormLabel>Date de naissance</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                              {field.value ? format(field.value, "PPP", { locale: fr }) : <span>Choisissez une date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            month={month}
                            onMonthChange={setMonth}
                            disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                            initialFocus
                            components={{
                              Caption: () => {
                                const currentYear = new Date().getFullYear();
                                const years = Array.from({ length: currentYear - 1919 }, (_, i) => currentYear - i);
                                const months = Array.from({ length: 12 }, (_, i) => new Date(0, i).toLocaleString('fr-FR', { month: 'long' }));

                                return (
                                  <div className="flex justify-center gap-2 mb-4">
                                    <Select
                                      value={String(month.getMonth())}
                                      onValueChange={(value) => {
                                        setMonth(currentMonth => set(currentMonth, { month: parseInt(value) }));
                                      }}
                                    >
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        {months.map((month, i) => (
                                          <SelectItem key={month} value={String(i)}>{month.charAt(0).toUpperCase() + month.slice(1)}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Select
                                      value={String(month.getFullYear())}
                                      onValueChange={(value) => {
                                        setMonth(currentMonth => set(currentMonth, { year: parseInt(value) }));
                                      }}
                                    >
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent style={{ maxHeight: '200px' }}>
                                        {years.map(year => (
                                          <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                );
                              },
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage /></FormItem>
                  )
                }} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ''}
                        placeholder={selectedCountry ? `${getCountryDialCode(selectedCountry)} XXX XXX XXX` : "+XXX XXX XXX XXX"}
                      />
                    </FormControl>
                    <FormDescription>Format international recommandé (ex: +243 123 456 789)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="country" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pays</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez un pays" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent style={{ maxHeight: '300px' }}>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ville</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!selectedCountry}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={selectedCountry ? "Sélectionnez une ville" : "Sélectionnez d'abord un pays"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent style={{ maxHeight: '300px' }}>
                        {selectedCountry && getCitiesByCountry(selectedCountry).map((city) => (
                          <SelectItem key={city} value={city}>
                            {city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedCountry && (
                      <FormDescription>
                        {getCitiesByCountry(selectedCountry).includes('Autre') ? "Sélectionnez 'Autre' si votre ville n'est pas listée" : ""}
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adresse</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} placeholder="Rue, avenue, numéro..." />
                    </FormControl>
                    <FormDescription>Adresse complète de votre domicile</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Sauvegarde..." : "Sauvegarder les modifications"}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      <PasswordUpdateCard />
    </div>
  );
};

export default ProfilePage;