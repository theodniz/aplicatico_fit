import { Ionicons } from '@expo/vector-icons';
import styled, { useTheme } from 'styled-components/native';
import { useUsers } from '../../hooks/useUsers';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorState, Loading } from '../../components/ui/Feedback';
import { Screen } from '../../components/ui/Screen';
import { Muted, Tag, Wrap } from '../../components/ui/Typography';
import { useAppNavigation } from '../../navigation/types';
import { getErrorMessage } from '../../lib/errors';
import { formatDate, initials } from '../../utils/format';
import { color, font, radius, space } from '../../theme/theme';

/**
 * Gestão de contas.
 *
 * Único lugar do sistema onde ser ADMIN concede algo. As regras do
 * Firestore só deixam listar `users/` quem é administrador.
 *
 * Fichas, exercícios, sessões e histórico continuam invisíveis
 * mesmo aqui: o isolamento vale para todo mundo.
 */
export default function AdminUsersScreen() {
  const theme = useTheme();
  const navigation = useAppNavigation();
  const { profile } = useAuth();
  const { data: users, isPending, isError, error, refetch, isRefetching } = useUsers();

  return (
    <Screen
      subtitle="Contas com acesso ao sistema"
      action={
        <Button size="sm" onPress={() => navigation.navigate('AdminUserEditor')}>
          Novo
        </Button>
      }
      onRefresh={() => void refetch()}
      refreshing={isRefetching}
    >
      {isPending && <Loading message="Carregando usuários…" />}

      {isError && (
        <ErrorState
          message={getErrorMessage(error, 'Não foi possível carregar os usuários.')}
          action={
            <Button variant="secondary" onPress={() => void refetch()}>
              Tentar novamente
            </Button>
          }
        />
      )}

      {!isPending && !isError && users?.length === 0 && (
        <EmptyState
          title="Nenhum usuário"
          message="Crie a primeira conta para liberar o acesso ao sistema."
          action={<Button onPress={() => navigation.navigate('AdminUserEditor')}>Criar usuário</Button>}
        />
      )}

      {users && users.length > 0 && (
        <List>
          {users.map((user) => (
            <Row
              key={user.id}
              onPress={() => navigation.navigate('AdminUserEditor', { userId: user.id })}
              accessibilityRole="button"
              accessibilityLabel={`Editar ${user.name}`}
            >
              <Avatar>
                <AvatarText>{initials(user.name)}</AvatarText>
              </Avatar>
              <RowMain>
                <RowTitle>
                  {user.name}
                  {user.id === profile?.id ? ' (você)' : ''}
                </RowTitle>
                <Muted numberOfLines={1}>{user.email}</Muted>
                <Wrap>
                  {user.role === 'ADMIN' && <Tag $accent>admin</Tag>}
                  <Tag>{`desde ${formatDate(user.created_at)}`}</Tag>
                </Wrap>
              </RowMain>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textSubtle} />
            </Row>
          ))}
        </List>
      )}
    </Screen>
  );
}

const List = styled.View`
  gap: ${space(2)};
`;

const Row = styled.Pressable`
  flex-direction: row;
  align-items: center;
  gap: ${space(3)};
  padding: ${space(3)} ${space(4)};
  border-radius: ${radius('md')};
  border-width: 1px;
  border-color: ${color('border')};
  background-color: ${color('surface')};
`;

const Avatar = styled.View`
  width: 40px;
  height: 40px;
  border-radius: 20px;
  align-items: center;
  justify-content: center;
  background-color: ${color('accentSoft')};
`;

const AvatarText = styled.Text`
  color: ${color('accent')};
  font-weight: 800;
`;

const RowMain = styled.View`
  flex: 1;
  gap: ${space(1)};
`;

const RowTitle = styled.Text`
  color: ${color('text')};
  font-size: ${font('base')};
  font-weight: 600;
`;
