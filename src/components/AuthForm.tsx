
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export function AuthForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      await signIn(email, password);
      toast({ title: 'Добро пожаловать!' });
    } catch (error: any) {
      toast({ 
        title: 'Ошибка входа', 
        description: error.message,
        variant: 'destructive' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;

    try {
      await signUp(email, password, {
        first_name: firstName,
        last_name: lastName,
      });
      toast({ title: 'Аккаунт создан! Проверьте email для подтверждения.' });
    } catch (error: any) {
      toast({ 
        title: 'Ошибка регистрации', 
        description: error.message,
        variant: 'destructive' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-blue-600">Telegram Clone</CardTitle>
          <CardDescription>Войдите или создайте аккаунт</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Вход</TabsTrigger>
              <TabsTrigger value="signup">Регистрация</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <Input
                  name="email"
                  type="email"
                  placeholder="Email"
                  required
                />
                <Input
                  name="password"
                  type="password"
                  placeholder="Пароль"
                  required
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Вход...' : 'Войти'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <Input
                  name="firstName"
                  type="text"
                  placeholder="Имя"
                  required
                />
                <Input
                  name="lastName"
                  type="text"
                  placeholder="Фамилия"
                  required
                />
                <Input
                  name="email"
                  type="email"
                  placeholder="Email"
                  required
                />
                <Input
                  name="password"
                  type="password"
                  placeholder="Пароль"
                  required
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Создание...' : 'Создать аккаунт'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
