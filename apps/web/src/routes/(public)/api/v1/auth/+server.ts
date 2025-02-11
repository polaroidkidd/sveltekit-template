import { PATHS } from '@cloudkit/ui-core';
import { AuthenticateUserSchema, RegisterUserSchema } from '@lib/client/auth/schemas';
import { auth } from '@lib/server/auth/lucia';
import { UserRepository } from '@lib/server/repository/user-repository';
import { UserService } from '@lib/server/services/user-service';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { Scrypt } from 'lucia';

export const POST: RequestHandler = async ({ request, cookies }) => {
	await auth.validateSession(cookies.get(auth.sessionCookieName) ?? '');

	const data = await request.formData();
	const {
		success,
		error,
		data: postData
	} = RegisterUserSchema.safeParse(Object.fromEntries(data.entries()));
	if (success && postData) {
		const userExists = await UserRepository.exists(postData.email);

		if (!userExists) {
			const created = await UserService.createUser(postData);
			const session = await auth.createSession(created.id, {});
			const sessionCookie = auth.createSessionCookie(session.id);
			cookies.set(sessionCookie.name, sessionCookie.value, {
				path: PATHS.ROOT,
				...sessionCookie.attributes
			});
			return json(created);
		} else {
			return new Response(null, { status: 409 });
		}
	} else {
		console.error('errors:', error);
	}
	return new Response(null, { status: 500 });
};
export const PUT: RequestHandler = async ({ request, cookies }) => {
	const formData = await request.json();

	const { success, data, error } = AuthenticateUserSchema.safeParse(formData);
	if (!success && error) {
		return json(error, {
			status: 400
		});
	}

	const userExists = await UserRepository.exists(data.email);

	if (!userExists) {
		return json({ message: 'computer sais no' }, { status: 400 });
	}
	const user = await UserRepository.findByEmail(data.email);
	const validPassword = await new Scrypt().verify(user.hashedPassword, data.password);

	if (!validPassword) {
		return new Response(null, { status: 500 });
	}
	const session = await auth.createSession(user.id, {});
	const sessionCookie = auth.createSessionCookie(session.id);
	cookies.set(sessionCookie.name, sessionCookie.value, {
		path: PATHS.ROOT,
		...sessionCookie.attributes
	});

	return json(user);
};
export const DELETE = async ({ locals, cookies }) => {
	if (!locals.session) {
		return new Response(null, { status: 401 });
	}
	await auth.invalidateSession(locals.session.id);
	const sessionCookie = auth.createBlankSessionCookie();
	cookies.set(sessionCookie.name, sessionCookie.value, {
		path: PATHS.ROOT,
		...sessionCookie.attributes
	});

	return new Response(null, { status: 200 });
};
