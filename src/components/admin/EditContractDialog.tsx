import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminUpdateContract } from "@/services/adminService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type ContractData = Database['public']['Tables']['contracts']['Row'];

interface EditContractDialogProps {
  contract: ContractData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formSchema = z.object({
  status: z.string().min(1, "Le statut est requis."),
  end_date: z.date().optional(),
  duration_months: z.preprocess(
    (val) => Number(val),
    z.number().int().positive("La durée doit être un nombre entier positif.").optional()
  ),
  months_paid: z.preprocess(
    (val) => Number(val),
    z.number().int().min(0, "Les mois payés ne peuvent pas être négatifs.").optional()
  ),
  total_profit_paid: z.preprocess(
    (val) => Number(val),
    z.number().min(0, "Le profit total payé ne peut pas être négatif.").optional()
  ),
  monthly_rate: z.preprocess(
    (val) => Number(val),
    z.number().min(0, "Le taux mensuel ne peut pas être négatif.").optional()
  ),
});

export const EditContractDialog = ({ contract, open, onOpenChange }: EditContractDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: contract.status,
      end_date: contract.end_date ? new Date(contract.end_date) : undefined,
      duration_months: contract.duration_months || undefined,
      months_paid: contract.months_paid || undefined,
      total_profit_paid: contract.total_profit_paid || undefined,
      monthly_rate: contract.monthly_rate || undefined,
    },
  });

  // Reset form when contract changes or dialog opens/closes
  useEffect(() => {
    form.reset({
      status: contract.status,
      end_date: contract.end_date ? new Date(contract.end_date) : undefined,
      duration_months: contract.duration_months || undefined,
      months_paid: contract.months_paid || undefined,
      total_profit_paid: contract.total_profit_paid || undefined,
      monthly_rate: contract.monthly_rate || undefined,
    });
  }, [contract, open, form]);

  const updateContractMutation = useMutation({
    mutationFn: ({ contractId, updates }: { contractId: string; updates: Record<string, any> }) =>
      adminUpdateContract(contractId, updates),
    onSuccess: () => {
      toast({ title: "Succès", description: "Contrat mis à jour avec succès." });
      queryClient.invalidateQueries({ queryKey: ["allContracts"] });
      queryClient.invalidateQueries({ queryKey: ["userContracts", contract.user_id] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const updates: Record<string, any> = {};
    for (const key in values) {
      const typedKey = key as keyof typeof values;
      // Only include fields that have changed
      if (values[typedKey] !== form.formState.defaultValues[typedKey]) {
        if (typedKey === 'end_date' && values[typedKey]) {
          updates[typedKey] = format(values[typedKey] as Date, 'yyyy-MM-dd'); // Format date for DB
        } else if (values[typedKey] !== undefined) {
          updates[typedKey] = values[typedKey];
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      toast({ title: "Information", description: "Aucune modification détectée." });
      onOpenChange(false);
      return;
    }

    updateContractMutation.mutate({ contractId: contract.id, updates });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Modifier le Contrat #{contract.id.substring(0, 8)}</DialogTitle>
          <DialogDescription>
            Apportez des modifications au contrat. Soyez prudent, certaines actions sont irréversibles.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Statut</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un statut" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="completed">Terminé</SelectItem>
                      <SelectItem value="refunded">Remboursé</SelectItem>
                      <SelectItem value="pending_refund">Demande Remboursement</SelectItem>
                      <SelectItem value="cancelled">Annulé</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="end_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date de fin</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Choisir une date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="duration_months"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Durée (mois)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="months_paid"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mois payés</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="total_profit_paid"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profit total payé</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="monthly_rate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Taux mensuel</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.0001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={updateContractMutation.isPending}>
                {updateContractMutation.isPending ? "Mise à jour..." : "Sauvegarder les modifications"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
