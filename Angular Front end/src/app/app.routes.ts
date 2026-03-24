import { Routes } from '@angular/router';
import { HomeComponent } from './Componants/home/home.component';
import { LoginComponent } from './Componants/login/login.component';
import { RegisterComponent } from './Componants/register/register.component';
import { FriendsComponent } from './Componants/friends/friends.component';
import { ChatsComponent } from './Componants/chats/chats.component';
import { PostsComponent } from './Componants/posts/posts.component';
import { SettingsComponent } from './Componants/settings/settings.component';
import { UserProfileComponent } from './Componants/user-profile/user-profile.component';
import { MainLayoutComponent } from './Componants/main-layout/main-layout.component';
import { authGuard, guestGuard } from './Services/auth/auth.guard';

export const routes: Routes = [
	{
		path: '',
		component: MainLayoutComponent,
		canActivate: [authGuard],
		children: [
			{
				path: '',
				component: HomeComponent
			},
			{
				path: 'friends',
				component: FriendsComponent
			},
			{
				path: 'chats',
				component: ChatsComponent
			},
			{
				path: 'posts',
				component: PostsComponent
			},
			{
				path: 'settings',
				component: SettingsComponent
			},
			{
				path: 'users/:id',
				component: UserProfileComponent
			}
		]
	},
	{
		path: 'login',
		component: LoginComponent,
		canActivate: [guestGuard]
	},
	{
		path: 'register',
		component: RegisterComponent,
		canActivate: [guestGuard]
	},
	{
		path: '**',
		redirectTo: ''
	}
];
