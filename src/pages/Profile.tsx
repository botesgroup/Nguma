import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProfile, updateProfile } from '@/services/profileService';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
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

const profileSchema = z.object({
  email: z.string().email().optional(),
  first_name: z.string().min(2, { message: "Le prénom est requis." }),
  last_name: z.string().min(2, { message: "Le nom est requis." }),
  post_nom: z.string().min(2, { message: "Le post-nom est requis." }),
  phone: z.string().min(10, { message: "Le numéro de téléphone est requis." }),
  country: z.string().min(2, { message: "Le pays est requis." }),
  address: z.string().min(5, { message: "L'adresse est requise." }),
  birth_date: z.date({ required_error: "La date de naissance est requise." }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const ProfilePage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAlertOpen, setIsAlertOpen] = useState(false);

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
      address: '',
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        email: profile.email || '',
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        post_nom: profile.post_nom || '',
        phone: profile.phone || '',
        country: profile.country || '',
        address: profile.address || '',
        birth_date: profile.birth_date ? new Date(profile.birth_date) : undefined,
      });

      const isProfileIncomplete = (
        !profile.first_name || profile.first_name.trim() === '' ||
        !profile.last_name || profile.last_name.trim() === '' ||
        !profile.post_nom || profile.post_nom.trim() === '' ||
        !profile.phone || profile.phone.trim() === '' ||
        !profile.country || profile.country.trim() === '' ||
        !profile.address || profile.address.trim() === '' ||
        !profile.birth_date
      );
      if (isProfileIncomplete) {
        setIsAlertOpen(true);
      }
    }
  }, [profile, form]);

  const mutation = useMutation({
    mutationFn: (values: ProfileFormValues) => {
      const dataToUpdate = {
        ...values,
        birth_date: values.birth_date ? format(values.birth_date, 'yyyy-MM-dd') : undefined,
      };
      return updateProfile(dataToUpdate);
    },
    onSuccess: (updatedProfile) => {
      toast({ title: "Succès", description: "Votre profil a été mis à jour." });
      queryClient.setQueryData(['profile'], updatedProfile);
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    },
  });

  const onSubmit = (values: ProfileFormValues) => {
    mutation.mutate(values);
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Mon Profil</h1>
        <p className="text-muted-foreground">Mettez à jour vos informations personnelles.</p>
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
          <CardTitle>Informations du Profil</CardTitle>
          <CardDescription>Ces informations nous aident à mieux vous connaître.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              <Skeleton className="h-8 w-24 mt-4" />
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
                  <FormItem><FormLabel>Téléphone</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem><FormLabel>Adresse</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="country" render={({ field }) => (
                  <FormItem><FormLabel>Pays</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Sauvegarde..." : "Sauvegarder les modifications"}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;